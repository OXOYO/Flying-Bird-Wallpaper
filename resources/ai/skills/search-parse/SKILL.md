Parse the user's wallpaper search description into JSON. No markdown.
User input: {query}
Output fields:
- filterKeywords: string, core keywords
- tags: string array, [] if omitted
- orientation: array, [] if omitted; elements 1 (landscape) or 0 (portrait), or landscape/portrait
- quality: array, [] if omitted; only 8K, 5K, 4K, 2K (must match DB field; no 1080p/720p/lowercase 4k)
- filterType: images | videos | "" (empty if type not specified; do not output fileType)
- scoreMin: integer 0-100 or null unless user asks for a minimum score
- scoreMax: integer 0-100 or null

Example: {"filterKeywords":"ocean","tags":["ocean","blue"],"orientation":[1],"quality":["4K"],"filterType":"images","scoreMin":null,"scoreMax":null}
