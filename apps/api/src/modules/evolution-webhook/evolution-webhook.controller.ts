import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { EvolutionWebhookService } from './evolution-webhook.service';

@ApiTags('Evolution webhook')
@Controller('webhooks/evolution')
export class EvolutionWebhookController {
  constructor(private readonly evolutionWebhookService: EvolutionWebhookService) {}

  @Public()
  @Post(':secret')
  @HttpCode(202)
  @ApiExcludeEndpoint()
  receive(@Param('secret') secret: string, @Body() payload: unknown) {
    return this.evolutionWebhookService.receive(secret, payload);
  }
}
