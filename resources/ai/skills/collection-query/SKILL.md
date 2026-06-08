The user wants to create a smart wallpaper collection. Parse the description into queryJson. Output JSON only.
User description: {prompt}
Fields:
- filterKeywords: string (core search term)
- tags: string[]
- tagsMode: any|all
- quality: string[] (must be [] unless user asks resolution; only 8K, 5K, 4K, 2K; no 1080p/720p)
(Do not output orientation, scoreMin, or scoreMax; minimum score comes from app AI settings.)
- resourceName: always "resources" (full library; never favorites/local/history)
- isRandom: boolean
- sortField: score|created_at|views
- sortType: -1|1
- semanticQuery: string
- useSemantic: boolean (true when theme/mood is described)
- limitCount: integer 5-50

Rules: tags must match resource AI tag language (prefer same as UI); do not invent orientation/quality/scoreMin/scoreMax; for entity words put the word in filterKeywords and add synonymous tags in the same language as resource tags.
