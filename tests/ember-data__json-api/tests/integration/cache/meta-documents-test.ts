import Cache from '@ember-data/json-api';
import type { StructuredDataDocument, StructuredDocument } from '@ember-data/request';
import type { CacheOperation } from '@ember-data/store';
import Store from '@ember-data/store';
import type { CacheCapabilitiesManager, SchemaService } from '@ember-data/store/types';
import type { StableDocumentIdentifier, StableExistingRecordIdentifier } from '@warp-drive/core-types/identifier';
import type { LegacyFieldSchema as FieldSchema } from '@warp-drive/core-types/schema/fields';
import type { CollectionResourceDataDocument, ResourceMetaDocument } from '@warp-drive/core-types/spec/document';
import { module, test } from '@warp-drive/diagnostic';

type AttributesSchema = ReturnType<SchemaService['attributesDefinitionFor']>;
type RelationshipsSchema = ReturnType<SchemaService['relationshipsDefinitionFor']>;

function asStructuredDocument<T>(doc: {
  request?: { url: string; cacheOptions?: { key?: string } };
  content: T;
}): StructuredDataDocument<T> {
  return doc as unknown as StructuredDataDocument<T>;
}

class TestStore extends Store {
  override createCache(wrapper: CacheCapabilitiesManager) {
    return new Cache(wrapper);
  }
}

type Schemas<T extends string> = Record<T, { attributes: AttributesSchema; relationships: RelationshipsSchema }>;
class TestSchema<T extends string> {
  declare schemas: Schemas<T>;
  constructor(schemas?: Schemas<T>) {
    this.schemas = schemas || ({} as Schemas<T>);
  }

  attributesDefinitionFor(identifier: { type: T }): AttributesSchema {
    return this.schemas[identifier.type]?.attributes || {};
  }

  _fieldsDefCache: Record<string, Map<string, FieldSchema>> = {};

  fields(identifier: { type: T }): Map<string, FieldSchema> {
    const { type } = identifier;
    let fieldDefs: Map<string, FieldSchema> | undefined = this._fieldsDefCache[type];

    if (fieldDefs === undefined) {
      fieldDefs = new Map();
      this._fieldsDefCache[type] = fieldDefs;

      const attributes = this.attributesDefinitionFor(identifier);
      const relationships = this.relationshipsDefinitionFor(identifier);

      for (const attr of Object.values(attributes)) {
        fieldDefs.set(attr.name, attr);
      }

      for (const rel of Object.values(relationships)) {
        fieldDefs.set(rel.name, rel);
      }
    }

    return fieldDefs;
  }

  relationshipsDefinitionFor(identifier: { type: T }): RelationshipsSchema {
    return this.schemas[identifier.type]?.relationships || {};
  }

  doesTypeExist(type: string) {
    return type in this.schemas ? true : Object.keys(this.schemas).length === 0 ? true : false;
  }
}

module('Integration | @ember-data/json-api Cach.put(<MetaDocument>)', function (hooks) {
  test('meta documents are correctly cached', function (assert) {
    const store = new TestStore();

    const responseDocument = store.cache.put(
      asStructuredDocument({
        request: { url: 'https://api.example.com/v1/users' },
        content: {
          meta: { count: 4 },
        },
      })
    );

    assert.false('data' in responseDocument, 'No data is associated');
    assert.deepEqual(responseDocument.meta, { count: 4 }, 'meta is correct');
    assert.equal(JSON.stringify(responseDocument.meta), JSON.stringify({ count: 4 }), 'meta is correct');
    assert.equal(responseDocument.lid, 'https://api.example.com/v1/users', 'lid is correct');

    const structuredDocument = store.cache.peekRequest({ lid: 'https://api.example.com/v1/users' });
    assert.deepEqual(
      structuredDocument as Partial<StructuredDocument<ResourceMetaDocument>>,
      {
        request: { url: 'https://api.example.com/v1/users' },
        content: {
          lid: 'https://api.example.com/v1/users',
          meta: { count: 4 },
        },
      },
      'We got the cached structured document back'
    );
    const cachedResponse = store.cache.peek({ lid: 'https://api.example.com/v1/users' });
    assert.deepEqual(
      cachedResponse,
      {
        lid: 'https://api.example.com/v1/users',
        meta: { count: 4 },
      },
      'We got the cached response document back'
    );
  });

  test('meta documents respect cacheOptions.key', function (assert) {
    const store = new TestStore();

    const responseDocument = store.cache.put(
      asStructuredDocument({
        request: { url: 'https://api.example.com/v1/users', cacheOptions: { key: 'users' } },
        content: {
          meta: { count: 4 },
        },
      })
    );

    assert.false('data' in responseDocument, 'No data is associated');
    assert.deepEqual(responseDocument.meta, { count: 4 }, 'meta is correct');
    assert.equal(JSON.stringify(responseDocument.meta), JSON.stringify({ count: 4 }), 'meta is correct');
    assert.equal(responseDocument.lid, 'users', 'lid is correct');

    const structuredDocument = store.cache.peekRequest({ lid: 'users' });
    const structuredDocument2 = store.cache.peekRequest({ lid: 'https://api.example.com/v1/users' });
    assert.equal(structuredDocument2, null, 'url is not cache key');
    assert.deepEqual(
      structuredDocument as Partial<StructuredDocument<ResourceMetaDocument>>,
      {
        request: { url: 'https://api.example.com/v1/users', cacheOptions: { key: 'users' } },
        content: {
          lid: 'users',
          meta: { count: 4 },
        },
      },
      'We got the cached structured document back'
    );
    const cachedResponse = store.cache.peek({ lid: 'users' });
    const cachedResponse2 = store.cache.peek({ lid: 'https://api.example.com/v1/users' });
    assert.equal(cachedResponse2, null, 'url is not cache key');
    assert.deepEqual(
      cachedResponse,
      {
        lid: 'users',
        meta: { count: 4 },
      },
      'We got the cached response document back'
    );
  });

  test('meta documents are correctly updated', function (assert) {
    const store = new TestStore();

    const responseDocument = store.cache.put(
      asStructuredDocument({
        request: { url: 'https://api.example.com/v1/users' },
        content: {
          meta: { count: 4, last: 4 },
        },
      })
    );

    assert.false('data' in responseDocument, 'No data is associated');
    assert.deepEqual(responseDocument.meta, { count: 4, last: 4 }, 'meta is correct');
    assert.equal(JSON.stringify(responseDocument.meta), JSON.stringify({ count: 4, last: 4 }), 'meta is correct');
    assert.equal(responseDocument.lid, 'https://api.example.com/v1/users', 'lid is correct');

    const structuredDocument = store.cache.peekRequest({ lid: 'https://api.example.com/v1/users' });
    assert.deepEqual(
      structuredDocument as Partial<StructuredDocument<ResourceMetaDocument>>,
      {
        request: { url: 'https://api.example.com/v1/users' },
        content: {
          lid: 'https://api.example.com/v1/users',
          meta: { count: 4, last: 4 },
        },
      },
      'We got the cached structured document back'
    );
    const cachedResponse = store.cache.peek({ lid: 'https://api.example.com/v1/users' });
    assert.deepEqual(
      cachedResponse,
      {
        lid: 'https://api.example.com/v1/users',
        meta: { count: 4, last: 4 },
      },
      'We got the cached response document back'
    );

    const responseDocument2 = store.cache.put(
      asStructuredDocument({
        request: { url: 'https://api.example.com/v1/users' },
        content: {
          meta: { count: 3, next: 8 },
        },
      })
    );

    assert.false('data' in responseDocument2, 'No data is associated');
    assert.deepEqual(responseDocument2.meta, { count: 3, next: 8 }, 'meta is correct');
    assert.equal(JSON.stringify(responseDocument2.meta), JSON.stringify({ count: 3, next: 8 }), 'meta is correct');
    assert.equal(responseDocument2.lid, 'https://api.example.com/v1/users', 'lid is correct');

    const structuredDocument2 = store.cache.peekRequest({ lid: 'https://api.example.com/v1/users' });
    assert.deepEqual(
      structuredDocument2 as Partial<StructuredDocument<ResourceMetaDocument>>,
      {
        request: { url: 'https://api.example.com/v1/users' },
        content: {
          lid: 'https://api.example.com/v1/users',
          meta: { count: 3, next: 8 },
        },
      },
      'We got the cached structured document back'
    );
    const cachedResponse2 = store.cache.peek({ lid: 'https://api.example.com/v1/users' });
    assert.deepEqual(
      cachedResponse2,
      {
        lid: 'https://api.example.com/v1/users',
        meta: { count: 3, next: 8 },
      },
      'We got the cached response document back'
    );
  });

  test('updating cache with a meta document disregards prior data', function (assert) {
    const store = new TestStore();
    store.registerSchema(new TestSchema());

    const responseDocument = store.cache.put(
      asStructuredDocument({
        request: { url: 'https://api.example.com/v1/users' },
        content: {
          data: [{ type: 'user', id: '1', attributes: { name: 'Chris' } }],
          meta: { count: 4, last: 4 },
        },
      })
    );
    const identifier = store.identifierCache.getOrCreateRecordIdentifier({
      type: 'user',
      id: '1',
    }) as StableExistingRecordIdentifier;

    assert.deepEqual(responseDocument.data, [identifier], 'data is associated');
    assert.deepEqual(responseDocument.meta, { count: 4, last: 4 }, 'meta is correct');
    assert.equal(JSON.stringify(responseDocument.meta), JSON.stringify({ count: 4, last: 4 }), 'meta is correct');
    assert.equal(responseDocument.lid, 'https://api.example.com/v1/users', 'lid is correct');

    const structuredDocument = store.cache.peekRequest({ lid: 'https://api.example.com/v1/users' });
    assert.deepEqual(
      structuredDocument as Partial<StructuredDocument<CollectionResourceDataDocument>>,
      {
        request: { url: 'https://api.example.com/v1/users' },
        content: {
          lid: 'https://api.example.com/v1/users',
          data: [identifier],
          meta: { count: 4, last: 4 },
        },
      },
      'We got the cached structured document back'
    );
    const cachedResponse = store.cache.peek({ lid: 'https://api.example.com/v1/users' });
    assert.deepEqual(
      cachedResponse,
      {
        lid: 'https://api.example.com/v1/users',
        data: [identifier],
        meta: { count: 4, last: 4 },
      },
      'We got the cached response document back'
    );

    const responseDocument2 = store.cache.put(
      asStructuredDocument({
        request: { url: 'https://api.example.com/v1/users' },
        content: {
          meta: { count: 3, next: 8 },
        },
      })
    );

    assert.false('data' in responseDocument2, 'No data is associated');
    assert.deepEqual(responseDocument2.meta, { count: 3, next: 8 }, 'meta is correct');
    assert.equal(JSON.stringify(responseDocument2.meta), JSON.stringify({ count: 3, next: 8 }), 'meta is correct');
    assert.equal(responseDocument2.lid, 'https://api.example.com/v1/users', 'lid is correct');

    const structuredDocument2 = store.cache.peekRequest({ lid: 'https://api.example.com/v1/users' });
    assert.deepEqual(
      structuredDocument2 as Partial<StructuredDocument<ResourceMetaDocument>>,
      {
        request: { url: 'https://api.example.com/v1/users' },
        content: {
          lid: 'https://api.example.com/v1/users',
          meta: { count: 3, next: 8 },
        },
      },
      'We got the cached structured document back'
    );
    const cachedResponse2 = store.cache.peek({ lid: 'https://api.example.com/v1/users' });
    assert.deepEqual(
      cachedResponse2,
      {
        lid: 'https://api.example.com/v1/users',
        meta: { count: 3, next: 8 },
      },
      'We got the cached response document back'
    );
  });

  test("notifications are generated for create and update of the document's cache key", function (assert) {
    assert.expect(10);
    const store = new TestStore();
    const documentIdentifier = store.identifierCache.getOrCreateDocumentIdentifier({
      url: '/api/v1/query?type=user&name=Chris&limit=1',
    })!;

    let isUpdating = false;
    store.notifications.subscribe('document', (identifier: StableDocumentIdentifier, type: CacheOperation) => {
      if (isUpdating) {
        assert.equal(type, 'updated', 'We were notified of an update');
        assert.equal(identifier, documentIdentifier, 'We were notified of the correct document');
      } else {
        assert.equal(type, 'added', 'We were notified of an add');
        assert.equal(identifier, documentIdentifier, 'We were notified of the correct document');
      }
    });

    store.notifications.subscribe(documentIdentifier, (identifier: StableDocumentIdentifier, type: CacheOperation) => {
      if (isUpdating) {
        assert.equal(type, 'updated', 'We were notified of an update');
        assert.equal(identifier, documentIdentifier, 'We were notified of the correct document');
      } else {
        assert.equal(type, 'added', 'We were notified of an add');
        assert.equal(identifier, documentIdentifier, 'We were notified of the correct document');
      }
    });

    store._run(() => {
      const responseDocument = store.cache.put(
        asStructuredDocument({
          request: {
            url: '/api/v1/query?type=user&name=Chris&limit=1',
          },
          content: {
            meta: { count: 4 },
          },
        })
      );

      assert.equal(responseDocument.meta.count, 4, 'We were given the correct data back');
    });

    isUpdating = true;
    store._run(() => {
      const responseDocument2 = store.cache.put(
        asStructuredDocument({
          request: {
            url: '/api/v1/query?type=user&name=Chris&limit=1',
          },
          content: {
            meta: { count: 3 },
          },
        })
      );

      assert.equal(responseDocument2.meta.count, 3, 'We were given the correct data back');
    });
  });
});
