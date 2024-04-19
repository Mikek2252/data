import { saveRecord } from '@ember-data/legacy-compat/builders';
// NOTE: Ideally the comment order and positioning would be unchanged, but due to limitations in recast, this doesn't seem possible
const post = store.createRecord<Post>('post', { name: 'Krystan rules, you drool' });
// 1
const { content: savedPost } = await store // 2
  // 3
  .request(
    saveRecord(
      // 4
      post, // 5
      // 6
      // 10
      // 11
      {
        // 7
        adapterOptions: {}, // 8
        // 9
      }
    )
  ); // 12
// 13
