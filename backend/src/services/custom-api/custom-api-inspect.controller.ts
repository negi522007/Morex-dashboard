import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../../auth/session.guard';
import { safeFetch, type SafeResponse } from '../../common/safe-fetch.util';
import { getPath } from '../../common/json-path.util';
import { fieldsOfItem, inspectJson, Inspection } from '../../common/json-inspect.util';

const MAX_BYTES = 1_000_000;
const EMPTY: Inspection = { root: 'scalar', values: [], lists: [] };

// Feeds the custom_api widgets' "path"/"titleField"/"subtitleField" fields (see WidgetParam.optionsUrl
// + dependsOn): fetches the URL the user already typed (through the same SSRF-safe fetcher the widget
// itself uses) and proposes real paths found in that exact response, instead of asking the user to
// guess. With no "path" query param it inspects the response root (for "path"); with one, it treats
// that path as an array and proposes the scalar fields of its first item (for "titleField"/"subtitleField").
@ApiTags('services')
@ApiCookieAuth('dashboard_session')
@Controller('services/custom_api')
@UseGuards(SessionGuard)
export class CustomApiInspectController {
  // Swappable in tests; in production this always goes through the SSRF guard.
  fetcher: (url: string, opts?: { timeoutMs?: number; maxBytes?: number }) => Promise<SafeResponse> = safeFetch;

  @Get('inspect')
  @ApiOperation({
    summary: 'Propose real JSON paths from the URL the user typed — for "path" (no `path` query param) or for "titleField"/"subtitleField" (pass the chosen list `path`)',
  })
  @ApiResponse({ status: 200, description: '{ root, values: [{path,label,sample}], lists: [{path,label,fields}] } — values/lists are candidates for "path"; with `path` given, "values" are the item\'s own fields' })
  @ApiResponse({ status: 400, description: 'Missing "url"' })
  async inspect(@Query('url') url?: string, @Query('path') path?: string, @Query('q') q?: string): Promise<Inspection> {
    const target = (url ?? '').trim();
    if (!target) throw new BadRequestException('url is required');

    let json: unknown;
    try {
      const res = await this.fetcher(target, { timeoutMs: 8_000, maxBytes: MAX_BYTES });
      if (!res.ok) return EMPTY;
      json = JSON.parse(res.text);
    } catch {
      // A bad/unreachable/non-JSON URL just means no suggestions — the field stays free text.
      return EMPTY;
    }

    let result: Inspection;
    if (path) {
      const node = getPath(json, path);
      result = { root: 'object', values: fieldsOfItem(Array.isArray(node) ? node[0] : undefined), lists: [] };
    } else {
      result = inspectJson(json);
    }

    const needle = (q ?? '').trim().toLowerCase();
    if (!needle) return result;
    return {
      root: result.root,
      values: result.values.filter((v) => v.path.toLowerCase().includes(needle)),
      lists: result.lists.filter((l) => l.path.toLowerCase().includes(needle)),
    };
  }
}
