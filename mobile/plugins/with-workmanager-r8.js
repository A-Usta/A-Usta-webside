'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');
const { mergeProguardRules } = require('./workmanager-proguard-rules');

module.exports = function withWorkmanagerR8(config) {
  return withDangerousMod(config, [
    'android',
    async config => {
      const rulesPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro',
      );
      let existing = '';
      try {
        existing = await fs.readFile(rulesPath, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }

      const updated = mergeProguardRules(existing);
      if (updated !== existing) {
        await fs.mkdir(path.dirname(rulesPath), { recursive: true });
        await fs.writeFile(rulesPath, updated, 'utf8');
      }
      return config;
    },
  ]);
};
