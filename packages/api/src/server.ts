import { loadEnv } from './config.js';
import { buildApp } from './app.js';

const config = loadEnv();
const app = await buildApp(config);

const shutdown = async (): Promise<void> => {
  await app.close();
};

const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const sig of signals) {
  process.on(sig, () => {
    void shutdown()
      .then(() => {
        process.exit(0);
      })
      .catch((err: unknown) => {
        console.error(err);
        process.exit(1);
      });
  });
}

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  app.log.info(`API listening on port ${config.PORT}`);
} catch (err) {
  app.log.error(err, 'Failed to start server');
  process.exit(1);
}
