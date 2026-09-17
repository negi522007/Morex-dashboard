import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AboutService } from './about.service';

@Controller()
export class AboutController {
  constructor(private readonly aboutService: AboutService) {}

  @Get('about.json')
  getAbout(@Req() req: Request) {
    return this.aboutService.build(req);
  }
}
