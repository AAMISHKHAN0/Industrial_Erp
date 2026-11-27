import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/strategies/supabase.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import {
  CreateVendorPaymentDto,
  CreateUtilityPaymentDto,
  CreateFixedAssetPaymentDto,
  CreateOutgoingPaymentDto,
  QueryPaymentsDto,
} from './dto/payment.dto';

@ApiTags('Finance - Outgoing Payments')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('finance/payments')
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @Get()
  findAll(@Query() query: QueryPaymentsDto) {
    return this.service.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateOutgoingPaymentDto, @Req() req: any) {
    return this.service.recordOutgoingPayment(dto, req.user?.id);
  }

  @Post('vendor')
  createVendorPayment(@Body() dto: CreateVendorPaymentDto, @Req() req: any) {
    return this.service.recordVendorPayment(dto, req.user?.id);
  }

  @Post('utility')
  createUtilityPayment(@Body() dto: CreateUtilityPaymentDto, @Req() req: any) {
    return this.service.recordUtilityPayment(dto, req.user?.id);
  }

  @Post('fixed-asset')
  createFixedAssetPayment(
    @Body() dto: CreateFixedAssetPaymentDto,
    @Req() req: any,
  ) {
    return this.service.recordFixedAssetPayment(dto, req.user?.id);
  }
}
