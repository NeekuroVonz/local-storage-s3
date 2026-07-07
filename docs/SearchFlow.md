# Search Flow

## Global Search

```
User types query → Debounce 300ms → GET /search?q=query
                                          │
                                    SearchService
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                        List all buckets        For each bucket:
                              │                 S3 ListObjectsV2
                              │                 Filter by query
                              │                       │
                              └─────── Merge ─────────┘
                                          │
                                    Return results
                                    (max 50 items)
```

## Search Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| q | string | Search query (min 2 chars) |
| bucket | string | Limit to specific bucket |
| prefix | string | Search within folder prefix |
| fileType | string | Filter by file extension |
| minSize | number | Minimum file size in bytes |
| maxSize | number | Maximum file size in bytes |
| limit | number | Max results (default 50) |

## Bucket-Scoped Search

When `bucket` parameter is provided, search only scans that bucket's objects using S3 ListObjectsV2 with prefix filtering.

## Saved Searches

Users can save search queries for reuse:

```
POST /search/saved
{ "name": "Large PDFs", "query": { "q": ".pdf", "minSize": 1048576 } }
```

Saved searches are stored per-user in the `saved_searches` table.

## Search History

Search history is tracked client-side via the search page state. Server-side history can be extended via activity logs.

## Performance Considerations

- S3 ListObjectsV2 is paginated (1000 keys per request)
- Global search iterates buckets sequentially
- For large deployments, consider indexing via background jobs
- Redis caching can be added for frequent queries

## Future Enhancements

- Elasticsearch/Meilisearch integration for metadata search
- Tag-based search via S3 object tagging API
- Full-text search within file contents
