import { findAll } from '@ember-data/legacy-compat/builders';
const post = store.request(
  findAll('post', {
    reload: true,
    backgroundReload: false,
    include: 'author,comments',
    adapterOptions: {},
  })
).content;
