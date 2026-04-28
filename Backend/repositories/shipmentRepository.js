function normalizeShipmentRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    shipmentNumber: row.shipment_number ?? row.shipmentNumber,
    orderId: row.order_id ?? row.orderId,
    orgId: row.org_id ?? row.orgId,
    assignedLogisticsUserId: row.assigned_logistics_user_id ?? row.assignedLogisticsUserId ?? null,
    status: row.status ?? null,
    carrier: row.carrier ?? null,
    trackingNumber: row.tracking_number ?? row.trackingNumber ?? null,
    eta: row.eta ?? null,
    lastScanAt: row.last_scan_at ?? row.lastScanAt ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

class ShipmentRepository {
  constructor(db) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('ShipmentRepository requires a database client with a query method');
    }

    this.db = db;
  }

  async findByIdForLogistics(shipmentId, orgId) {
    const result = await this.db.query(
      `SELECT
         id,
         shipment_number,
         order_id,
         org_id,
         assigned_logistics_user_id,
         status,
         carrier,
         tracking_number,
         eta,
         last_scan_at,
         created_at,
         updated_at
       FROM shipments
       WHERE id = $1
         AND org_id = $2
       LIMIT 1`,
      [shipmentId, orgId],
    );

    return normalizeShipmentRow(result.rows[0]);
  }

  async findAssignedShipments(logisticsUserId, orgId, limit = 50, offset = 0) {
    const result = await this.db.query(
      `SELECT
         id,
         shipment_number,
         order_id,
         org_id,
         assigned_logistics_user_id,
         status,
         carrier,
         tracking_number,
         eta,
         last_scan_at,
         created_at,
         updated_at
       FROM shipments
       WHERE assigned_logistics_user_id = $1
         AND org_id = $2
       ORDER BY updated_at DESC, id DESC
       LIMIT $3 OFFSET $4`,
      [logisticsUserId, orgId, limit, offset],
    );

    return result.rows.map(normalizeShipmentRow);
  }

  async recordPackageScan(shipmentId, payload) {
    const result = await this.db.query(
      `UPDATE shipments
       SET last_scan_at = NOW(),
           status = COALESCE($2, status),
           updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         shipment_number,
         order_id,
         org_id,
         assigned_logistics_user_id,
         status,
         carrier,
         tracking_number,
         eta,
         last_scan_at,
         created_at,
         updated_at`,
      [shipmentId, payload?.status ?? null],
    );

    return normalizeShipmentRow(result.rows[0]);
  }
}

module.exports = {
  ShipmentRepository,
};