import { saveRecord } from '@ember-data/legacy-compat/builders';
const post = store.createRecord('post', { name: 'Krystan rules, you drool' });
const { content: savedPost } = store.request(saveRecord(post));
