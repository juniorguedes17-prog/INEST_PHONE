import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DuplicateOfferDto, GenerateOfferDto, UpdateOfferTemplateDto } from '../dto/offers.dto';
import { OffersService } from '../service/offers.service';

@ApiTags('Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('offers')
export class OffersController {
  constructor(@Inject(OffersService) private readonly offersService: OffersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista ofertas geradas.' })
  list() {
    return this.offersService.list();
  }

  @Get('templates')
  @ApiOperation({ summary: 'Lista templates comerciais disponiveis.' })
  templates() {
    return this.offersService.templates();
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Atualiza o conteudo de um template comercial oficial.' })
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateOfferTemplateDto) {
    return this.offersService.updateTemplate(id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta oferta.' })
  findOne(@Param('id') id: string) {
    return this.offersService.findOne(id);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Gera oferta a partir da precificacao oficial.' })
  generate(@Body() dto: GenerateOfferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offersService.generate(dto, user);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplica oferta existente.' })
  duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateOfferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.offersService.duplicate(id, dto, user);
  }

  @Post(':id/copy')
  @ApiOperation({ summary: 'Registra copia da mensagem.' })
  copy(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offersService.registerCopy(id, user);
  }

  @Post(':id/share')
  @ApiOperation({ summary: 'Retorna link de compartilhamento WhatsApp.' })
  share(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offersService.registerShare(id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancela oferta usando exclusao logica.' })
  softDelete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offersService.softDelete(id, user);
  }
}
