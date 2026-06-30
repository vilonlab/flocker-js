module.exports = {
  apps: [
    {
      name: 'flocker-server',
      script: './node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: '2567',
      },
    },
  ],
};
