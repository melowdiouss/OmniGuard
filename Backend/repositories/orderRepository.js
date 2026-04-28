function normalizeOrderRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderNumber: row.order_number ?? row.orderNumber,
    customerId: row.customer_id ?? row.customerId,
    orgId: row.org_id ?? row.orgId,
    status: row.status ?? null,
    totalAmount: row.total_amount ?? row.totalAmount ?? null,
    currency: row.currency ?? null,
    shippingAddress: row.shipping_address ?? row.shippingAddress ?? null,
    billingAddress: row.billing_address ?? row.billingAddress ?? null,
    orderData: row.order_data ?? row.orderData ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function normalizeTimelineRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.order_id ?? row.orderId,
    shipmentId: row.shipment_id ?? row.shipmentId ?? null,
    scanId: row.scan_id ?? row.scanId ?? null,
    eventType: row.event_type ?? row.eventType,
    status: row.status ?? null,
    location: row.location ?? null,
    description: row.description ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
  };
}

class OrderRepository {
  constructor(db) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('OrderRepository requires a database client with a query method');
    }

    this.db = db;
  }

  async findByIdForCustomer(orderId, customerId, orgId) {
    const result = await this.db.query(
      `SELECT
         id,
         order_number,
         customer_id,
         org_id,
         status,
         total_amount,
         currency,
         shipping_address,
         billing_address,
         order_data,
         created_at,
         updated_at
       FROM orders
       WHERE id = $1
         AND customer_id = $2
         AND org_id = $3
       LIMIT 1`,
      [orderId, customerId, orgId],
    );

    return normalizeOrderRow(result.rows[0]);
  }

  async findByIdForLogistics(orderId, orgId) {
    const result = await this.db.query(
      `SELECT
         id,
         order_number,
         customer_id,
         org_id,
         status,
         total_amount,
         currency,
         shipping_address,
         billing_address,
         order_data,
         created_at,
         updated_at
       FROM orders
       WHERE id = $1
         AND org_id = $2
       LIMIT 1`,
      [orderId, orgId],
    );

    return normalizeOrderRow(result.rows[0]);
  }

  async findTrackingTimeline(orderId, orgId, limit = 100) {
    const result = await this.db.query(
      `SELECT
         id,
         order_id,
         shipment_id,
         scan_id,
         event_type,
         status,
         location,
         description,
         metadata,
         created_at
       FROM order_tracking_events
       WHERE order_id = $1
         AND org_id = $2
       ORDER BY created_at ASC
       LIMIT $3`,
      [orderId, orgId, limit],
    );

    return result.rows.map(normalizeTimelineRow);
  }
}

module.exports = {
  OrderRepository,
};