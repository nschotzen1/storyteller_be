module.exports = function (api) {
  const isTest = api.env('test'); // Check if Jest is running (Jest sets NODE_ENV to 'test')

  return {
    presets: [
      [
        '@babel/preset-env',
        {
          targets: { node: 'current' },
          // Keep ES modules when testing in a Node ESM environment,
          // otherwise transpile to CommonJS for other environments if needed.
          modules: isTest ? false : 'commonjs',
        },
      ],
    ],
  };
};
