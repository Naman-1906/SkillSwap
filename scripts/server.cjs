// The root "server" command is always the local development server.
process.env.NODE_ENV = 'development';
process.env.PORT = '5000';

require('../backend/server.js');
