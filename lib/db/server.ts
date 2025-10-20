// This file provides a safe way to import the database
// It ensures db is only accessed on the server side

import 'server-only';

export { db } from './index';
