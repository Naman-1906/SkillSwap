const path = require('path');
const dotenv = require('dotenv');

const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');

const loadRootEnv = () => {
  const rootEnv = dotenv.config({ path: rootEnvPath, quiet: true });
  const hasRootCloudinaryConfig = Object.hasOwn(rootEnv.parsed || {}, 'CLOUDINARY_CLOUD_NAME');
  process.env.CLOUDINARY_ENV_SOURCE = hasRootCloudinaryConfig
    ? 'root .env'
    : 'runtime environment';
  return rootEnv;
};

module.exports = { loadRootEnv, rootEnvPath };
