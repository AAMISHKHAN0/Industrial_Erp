import { Module } from '@nestjs/common';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { PayrollModule } from './payroll/payroll.module';
import { WageModule } from './wages/wage.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [AttendanceModule, LeaveModule, PayrollModule, WageModule, FinanceModule],
  exports: [AttendanceModule, LeaveModule, PayrollModule, WageModule],
})
export class HrModule {}
