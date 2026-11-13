const mongoose = require('./mongoose');

const mediaAssetSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true },
  originalName: { type: String, required: true },
  ownerId: { type: String, default: '' },
  source: { type: String, default: 'legacy-upload-migration' },
  status: { type: String, enum: ['active', 'archived-unreferenced', 'references-migrated'], required: true },
  secureUrl: { type: String, default: '' },
  resourceType: { type: String, enum: ['image', 'video', 'raw', ''], default: '' },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  category: { type: String, default: '' },
  relatedEntityId: { type: String, default: '' },
  migrationSource: { type: String, default: '' },
  migratedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('MediaAsset', mediaAssetSchema);
