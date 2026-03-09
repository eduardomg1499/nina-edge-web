import fs from 'fs';
fetch('https://christian-photo.github.io/github-page/_app/immutable/assets/api_spec.DG1lxRCh.yaml')
  .then(r => r.text())
  .then(t => fs.writeFileSync('api_spec.yaml', t));
