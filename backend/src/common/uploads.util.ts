import { join } from 'node:path';

// Uploaded avatar photos live here (see docker-compose.yml's uploads_data
// volume, and main.ts's app.useStaticAssets serving it at /uploads).
export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const AVATARS_DIR = join(UPLOADS_DIR, 'avatars');
