function normalizeAlertRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    alertKey: row.alert_key ?? row.alertKey,
    decisionKey: row.decision_key ?? row.decisionKey,
    orderId: row.order_id ?? row.orderId,
    shipmentId: row.shipment_id ?? row.shipmentId ?? null,
    orgId: row.org_id ?? row.orgId,
    severity: row.severity ?? null,
    status: row.status ?? null,
    reason: row.reason ?? null,
    responsibilityStatus: row.responsibility_status ?? row.responsibilityStatus ?? null,
    ownerUserId: row.owner_user_id ?? row.ownerUserId ?? null,
    ownerRole: row.owner_role ?? row.ownerRole ?? null,
    ownerTeam: row.owner_team ?? row.ownerTeam ?? null,
    metadata: row.metadata ?? null,
    createdByUserId: row.created_by_user_id ?? row.createdByUserId ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function normalizeReverseShipmentRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    reverseShipmentKey: row.reverse_shipment_key ?? row.reverseShipmentKey,
    alertId: row.alert_id ?? row.alertId ?? null,
    decisionKey: row.decision_key ?? row.decisionKey,
    orderId: row.order_id ?? row.orderId,
    shipmentId: row.shipment_id ?? row.shipmentId ?? null,
    orgId: row.org_id ?? row.orgId,
    status: row.status ?? null,
    assignedToUserId: row.assigned_to_user_id ?? row.assignedToUserId ?? null,
    assignedRole: row.assigned_role ?? row.assignedRole ?? null,
    carrier: row.carrier ?? null,
    trackingNumber: row.tracking_number ?? row.trackingNumber ?? null,
    metadata: row.metadata ?? null,
    createdByUserId: row.created_by_user_id ?? row.createdByUserId ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function serializeJSON(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
}

class ReverseLogisticsRepository {
  constructor(db) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('ReverseLogisticsRepository requires a database client with a query method');
    }

    this.db = db;
  }

  async findAlertByDecisionKey(decisionKey, orgId) {
    const result = await this.db.query(
      `SELECT
         id,
         alert_key,
         decision_key,
         order_id,
         shipment_id,
         org_id,
         severity,
         status,
         reason,
         responsibility_status,
         owner_user_id,
         owner_role,
         owner_team,
         metadata,
         created_by_user_id,
         created_at,
         updated_at
       FROM reverse_logistics_alerts
       WHERE decision_key = $1
         AND org_id = $2
       LIMIT 1`,
      [decisionKey, orgId],
    );

    return normalizeAlertRow(result.rows[0]);
  }

  async createAlert({
    alertKey,
    decisionKey,
    orderId,
    shipmentId = null,
    orgId,
    severity = 'HIGH',
    status = 'OPEN',
    reason,
    responsibilityStatus = 'UNASSIGNED',
    ownerUserId = null,
    ownerRole = 'LOGISTICS',
    ownerTeam = 'REVERSE_LOGISTICS',
    metadata = {},
    createdByUserId = null,
  }) {
    const result = await this.db.query(
      `INSERT INTO reverse_logistics_alerts (
         alert_key,
         decision_key,
         order_id,
         shipment_id,
         org_id,
         severity,
         status,
         reason,
         responsibility_status,
         owner_user_id,
         owner_role,
         owner_team,
         metadata,
         created_by_user_id,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
       RETURNING
         id,
         alert_key,
         decision_key,
         order_id,
         shipment_id,
         org_id,
         severity,
         status,
         reason,
         responsibility_status,
         owner_user_id,
         owner_role,
         owner_team,
         metadata,
         created_by_user_id,
         created_at,
         updated_at`,
      [
        alertKey,
        decisionKey,
        orderId,
        shipmentId,
        orgId,
        severity,
        status,
        reason,
        responsibilityStatus,
        ownerUserId,
        ownerRole,
        ownerTeam,
        serializeJSON(metadata),
        createdByUserId,
      ],
    );

    return normalizeAlertRow(result.rows[0]);
  }

  async updateAlert(alertId, patch, tx = null) {
    const dbClient = tx || this.db;
    const result = await dbClient.query(
      `UPDATE reverse_logistics_alerts
       SET status = COALESCE($1, status),
           severity = COALESCE($2, severity),
           reason = COALESCE($3, reason),
           responsibility_status = COALESCE($4, responsibility_status),
           owner_user_id = COALESCE($5, owner_user_id),
           owner_role = COALESCE($6, owner_role),
           owner_team = COALESCE($7, owner_team),
           metadata = COALESCE($8, metadata),
           updated_at = NOW()
       WHERE id = $9
       RETURNING
         id,
         alert_key,
         decision_key,
         order_id,
         shipment_id,
         org_id,
         severity,
         status,
         reason,
         responsibility_status,
         owner_user_id,
         owner_role,
         owner_team,
         metadata,
         created_by_user_id,
         created_at,
         updated_at`,
      [
        patch.status ?? null,
        patch.severity ?? null,
        patch.reason ?? null,
        patch.responsibilityStatus ?? null,
        patch.ownerUserId ?? null,
        patch.ownerRole ?? null,
        patch.ownerTeam ?? null,
        patch.metadata !== undefined ? serializeJSON(patch.metadata) : null,
        alertId,
      ],
    );

    return normalizeAlertRow(result.rows[0]);
  }

  async findReverseShipmentByDecisionKey(decisionKey, orgId) {
    const result = await this.db.query(
      `SELECT
         id,
         reverse_shipment_key,
         alert_id,
         decision_key,
         order_id,
         shipment_id,
         org_id,
         status,
         assigned_to_user_id,
         assigned_role,
         carrier,
         tracking_number,
         metadata,
         created_by_user_id,
         created_at,
         updated_at
       FROM reverse_shipments
       WHERE decision_key = $1
         AND org_id = $2
       LIMIT 1`,
      [decisionKey, orgId],
    );

    return normalizeReverseShipmentRow(result.rows[0]);
  }

  async createReverseShipment({
    reverseShipmentKey,
    alertId,
    decisionKey,
    orderId,
    shipmentId = null,
    orgId,
    status = 'REQUESTED',
    assignedToUserId = null,
    assignedRole = 'LOGISTICS',
    carrier = null,
    trackingNumber = null,
    metadata = {},
    createdByUserId = null,
  }) {
    const result = await this.db.query(
      `INSERT INTO reverse_shipments (
         reverse_shipment_key,
         alert_id,
         decision_key,
         order_id,
         shipment_id,
         org_id,
         status,
         assigned_to_user_id,
         assigned_role,
         carrier,
         tracking_number,
         metadata,
         created_by_user_id,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       RETURNING
         id,
         reverse_shipment_key,
         alert_id,
         decision_key,
         order_id,
         shipment_id,
         org_id,
         status,
         assigned_to_user_id,
         assigned_role,
         carrier,
         tracking_number,
         metadata,
         created_by_user_id,
         created_at,
         updated_at`,
      [
        reverseShipmentKey,
        alertId,
        decisionKey,
        orderId,
        shipmentId,
        orgId,
        status,
        assignedToUserId,
        assignedRole,
        carrier,
        trackingNumber,
        serializeJSON(metadata),
        createdByUserId,
      ],
    );

    return normalizeReverseShipmentRow(result.rows[0]);
  }

  async updateReverseShipmentStatus(reverseShipmentId, patch, tx = null) {
    const dbClient = tx || this.db;
    const result = await dbClient.query(
      `UPDATE reverse_shipments
       SET status = COALESCE($1, status),
           assigned_to_user_id = COALESCE($2, assigned_to_user_id),
           assigned_role = COALESCE($3, assigned_role),
           carrier = COALESCE($4, carrier),
           tracking_number = COALESCE($5, tracking_number),
           metadata = COALESCE($6, metadata),
           updated_at = NOW()
       WHERE id = $7
       RETURNING
         id,
         reverse_shipment_key,
         alert_id,
         decision_key,
         order_id,
         shipment_id,
         org_id,
         status,
         assigned_to_user_id,
         assigned_role,
         carrier,
         tracking_number,
         metadata,
         created_by_user_id,
         created_at,
         updated_at`,
      [
        patch.status ?? null,
        patch.assignedToUserId ?? null,
        patch.assignedRole ?? null,
        patch.carrier ?? null,
        patch.trackingNumber ?? null,
        patch.metadata !== undefined ? serializeJSON(patch.metadata) : null,
        reverseShipmentId,
      ],
    );

    return normalizeReverseShipmentRow(result.rows[0]);
  }
}

module.exports = {
  ReverseLogisticsRepository,
};