import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AboutService } from './about.service';

@ApiTags('about')
@Controller()
export class AboutController {
  constructor(private readonly aboutService: AboutService) {}

  @Get('about.json')
  @ApiOperation({
    summary: "The brief's mandatory endpoint — also the live source of truth for available services/widgets",
  })
  @ApiResponse({ status: 200, description: 'Client/server info plus every registered service and widget' })
  getAbout(@Req() req: Request) {
    return this.aboutService.build(req);
  }
}
