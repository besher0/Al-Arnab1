import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const tailwindCli = join('node_modules', 'tailwindcss', 'lib', 'cli.js');
const inputFile = 'tailwind/stitch/input.css';

const builds = [
  { page: 'welcome', config: 'welcome.config.cjs' },
  { page: 'home', config: 'home.config.cjs' },
  { page: 'home-offers', config: 'home-offers.config.cjs' },
  { page: 'categories', config: 'catalog.config.cjs' },
  { page: 'category-products', config: 'catalog.config.cjs' },
  { page: 'product', config: 'product.config.cjs' },
  { page: 'cart', config: 'cart.config.cjs' },
  { page: 'orders', config: 'orders.config.cjs' },
  { page: 'notifications', config: 'orders.config.cjs' },
  { page: 'profile', config: 'profile.config.cjs' },
  { page: 'login', config: 'auth.config.cjs' },
  { page: 'signup', config: 'auth.config.cjs' },
];

for (const build of builds) {
  const configPath = join('tailwind', 'stitch', 'configs', build.config);
  const outputPath = join('public', 'stitch', 'tailwind', `${build.page}.css`);

  mkdirSync(dirname(outputPath), { recursive: true });

  const result = spawnSync(
    process.execPath,
    [tailwindCli, '-c', configPath, '-i', inputFile, '-o', outputPath, '--minify'],
    { stdio: 'inherit' },
  );

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
