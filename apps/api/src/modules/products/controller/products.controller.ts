import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
  UpsertCategoryDto,
  UpsertColorDto,
  UpsertModelDto,
  UpsertStorageDto,
} from '../dto/product.dto';
import { ProductsService } from '../service/products.service';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(@Inject(ProductsService) private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista produtos do catalogo.' })
  list(@Query() query: ProductQueryDto) {
    return this.productsService.list(query);
  }

  @Get('references')
  @ApiOperation({ summary: 'Lista categorias, modelos, cores e capacidades.' })
  references() {
    return this.productsService.references();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.update(id, dto, user);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.softDelete(id, user);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.activate(id, user);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.productsService.deactivate(id, user);
  }

  @Post('categories')
  createCategory(@Body() dto: UpsertCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpsertCategoryDto) {
    return this.productsService.updateCategory(id, dto);
  }

  @Post('models')
  createModel(@Body() dto: UpsertModelDto) {
    return this.productsService.createModel(dto);
  }

  @Patch('models/:id')
  updateModel(@Param('id') id: string, @Body() dto: UpsertModelDto) {
    return this.productsService.updateModel(id, dto);
  }

  @Post('colors')
  createColor(@Body() dto: UpsertColorDto) {
    return this.productsService.createColor(dto);
  }

  @Patch('colors/:id')
  updateColor(@Param('id') id: string, @Body() dto: UpsertColorDto) {
    return this.productsService.updateColor(id, dto);
  }

  @Post('storages')
  createStorage(@Body() dto: UpsertStorageDto) {
    return this.productsService.createStorage(dto);
  }

  @Patch('storages/:id')
  updateStorage(@Param('id') id: string, @Body() dto: UpsertStorageDto) {
    return this.productsService.updateStorage(id, dto);
  }
}
