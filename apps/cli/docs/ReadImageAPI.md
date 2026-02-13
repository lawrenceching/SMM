# Read Image API

Read Image API read image file and return the base64 encoded data;

POST /api/readImage

```typescript
interface ReadImageRequestBody {
    path: string;
}

interface ReadImageResponseBody {
    /**
     * In a format "data:image:xxxx"
     */ 
    data: string;
}
```