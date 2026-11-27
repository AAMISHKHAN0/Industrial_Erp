export abstract class DomainEvent {
  public readonly occurredAt: Date = new Date();
  constructor(
    public readonly name: string,
    public readonly payload: Record<string, any>,
  ) {}
}

export class PurchaseOrderApprovedEvent extends DomainEvent {
  constructor(payload: {
    purchaseOrderId: string;
    poNumber: string;
    vendorId: string;
    totalAmount: number;
  }) {
    super('PurchaseOrderApproved', payload);
  }
}

export class GoodsReceivedEvent extends DomainEvent {
  constructor(payload: {
    grnId: string;
    grnNumber: string;
    poId: string;
    warehouseId: string;
    items: Array<{ itemId: string; acceptedQty: number; unitCost: number }>;
  }) {
    super('GoodsReceived', payload);
  }
}

export class InventoryUpdatedEvent extends DomainEvent {
  constructor(payload: {
    itemId: string;
    warehouseId: string;
    transactionType: string;
    qtyChange: number;
    referenceId: string;
    referenceType: string;
  }) {
    super('InventoryUpdated', payload);
  }
}

export class SalesOrderConfirmedEvent extends DomainEvent {
  constructor(payload: {
    salesOrderId: string;
    soNumber: string;
    customerId: string;
    totalAmount: number;
    items: Array<{ itemId: string; quantity: number }>;
  }) {
    super('SalesOrderConfirmed', payload);
  }
}

export class DeliveryNoteCreatedEvent extends DomainEvent {
  constructor(payload: {
    deliveryNoteId: string;
    salesOrderId: string;
    warehouseId: string;
    items: Array<{ itemId: string; quantity: number }>;
  }) {
    super('DeliveryNoteCreated', payload);
  }
}

export class ProductionCompletedEvent extends DomainEvent {
  constructor(payload: {
    productionOrderId: string;
    itemId: string;
    producedQty: number;
    rejectedQty: number;
  }) {
    super('ProductionCompleted', payload);
  }
}

export class PayrollProcessedEvent extends DomainEvent {
  constructor(payload: {
    periodId: string;
    totalSalary: number;
    paySlipIds: string[];
  }) {
    super('PayrollProcessed', payload);
  }
}
