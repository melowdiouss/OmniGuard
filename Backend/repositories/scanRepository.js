function serializeNullableJSON(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return typeof value === 'string' ? value : JSON.stringify(value);
}

function normalizeRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    productId: row.product_id ?? row.productId,
    parcelId: row.parcel_id ?? row.parcelId ?? null,
    orgId: row.org_id ?? row.orgId,
    scanType: row.scan_type ?? row.scanType ?? null,
    scanData: row.scan_data ?? row.scanData ?? null,
    images: row.images ?? [],
    status: row.status ?? null,
    validationStatus: row.validation_status ?? row.validationStatus ?? null,
    validationScore: row.validation_score ?? row.validationScore ?? null,
    validationResult: row.validation_result ?? row.validationResult ?? null,
    aiProvider: row.ai_provider ?? row.aiProvider ?? null,
    aiValidatedAt: row.ai_validated_at ?? row.aiValidatedAt ?? null,
    createdByUserId: row.created_by_user_id ?? row.createdByUserId ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

class ScanRepository {
  constructor(db) {
    if (!db || typeof db.query !== 'function') {
      throw new Error('ScanRepository requires a database client with a query method');
    }

    this.db = db;
  }

  async create({
    productId,
    parcelId = null,
    orgId,
    scanType,
    scanData,
    images = [],
    status = 'QUEUED',
    validationStatus = 'PENDING',
    createdByUserId = null,
  }) {
    const result = await this.db.query(
      `INSERT INTO scans (
         product_id,
         parcel_id,
         org_id,
         scan_type,
         scan_data,
         images,
         status,
         validation_status,
         created_by_user_id,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING
         id,
         product_id,
         parcel_id,
         org_id,
         scan_type,
         scan_data,
         images,
         status,
         validation_status,
         validation_score,
         validation_result,
         ai_provider,
         ai_validated_at,
         created_by_user_id,
         created_at,
         updated_at`,
      [
        productId,
        parcelId,
        orgId,
        scanType,
        serializeNullableJSON(scanData),
        serializeNullableJSON(images),
        status,
        validationStatus,
        createdByUserId,
      ],
    );

    return normalizeRow(result.rows[0]);
  }

  async findById(id) {
    const result = await this.db.query(
      `SELECT
         id,
         product_id,
         parcel_id,
         org_id,
         scan_type,
         scan_data,
         images,
         status,
         validation_status,
         validation_score,
         validation_result,
         ai_provider,
         ai_validated_at,
         created_by_user_id,
         created_at,
         updated_at
       FROM scans
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return normalizeRow(result.rows[0]);
  }

  async attachImages(id, images) {
    const result = await this.db.query(
      `UPDATE scans
       SET images = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING
         id,
         product_id,
         parcel_id,
         org_id,
         scan_type,
         scan_data,
         images,
         status,
         validation_status,
         validation_score,
         validation_result,
         ai_provider,
         ai_validated_at,
         created_by_user_id,
         created_at,
         updated_at`,
      [serializeNullableJSON(images), id],
    );

    return normalizeRow(result.rows[0]);
  }

  async updateImages(id, images) {
    return this.attachImages(id, images);
  }

  async updateValidationResult(
    id,
    { status, validationStatus, validationScore, validationResult, aiProvider, aiValidatedAt },
  ) {
    const result = await this.db.query(
      `UPDATE scans
       SET status = $1,
           validation_status = $2,
           validation_score = $3,
           validation_result = $4,
           ai_provider = $5,
           ai_validated_at = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING
         id,
         product_id,
         parcel_id,
         org_id,
         scan_type,
         scan_data,
         images,
         status,
         validation_status,
         validation_score,
         validation_result,
         ai_provider,
         ai_validated_at,
         created_by_user_id,
         created_at,
         updated_at`,
      [
        status,
        validationStatus,
        validationScore,
        serializeNullableJSON(validationResult),
        aiProvider,
        aiValidatedAt,
        id,
      ],
    );

    return normalizeRow(result.rows[0]);
  }
}

module.exports = {
  ScanRepository,
};