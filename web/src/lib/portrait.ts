/**
 * Preparing a chosen file for upload.
 *
 * The card draws the portrait at 64px and the API stores whatever it is sent, so a 4 MB phone
 * photograph would be four megabytes in the database and four megabytes down the wire to render a
 * thumbnail. Downscaling here rather than on the server keeps the API's job to storing bytes, and
 * keeps the upload small enough that it finishes before the user has stopped looking at it.
 */

/** Square, and large enough to stay sharp on a 2× display at twice the size the card draws it. */
export const PORTRAIT_SIZE = 256;

/** What the API accepts. A file picked outside this list is refused before any work is done. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

/** The type the canvas re-encodes to. WebP at this size is a third of the equivalent JPEG. */
const OUTPUT_TYPE = "image/webp";
const OUTPUT_QUALITY = 0.85;

export class PortraitError extends Error {
  /** A key into the dictionaries — the message itself is never shown. */
  readonly key: "portraitType" | "portraitUnreadable";

  constructor(key: "portraitType" | "portraitUnreadable") {
    super(key);
    this.name = "PortraitError";
    this.key = key;
  }
}

/**
 * A square, downscaled WebP of the chosen file.
 *
 * `imageOrientation: "from-image"` is load-bearing: a photograph taken on a phone carries its
 * rotation in EXIF, and a bitmap decoded without it lands in the canvas on its side. The crop is
 * centred and covers rather than fits, because a card of portraits with letterboxing in them is a
 * card of different-shaped holes.
 */
export async function preparePortrait(file: File): Promise<Blob> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type))
    throw new PortraitError("portraitType");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PortraitError("portraitUnreadable");
  }

  const canvas = document.createElement("canvas");
  canvas.width = PORTRAIT_SIZE;
  canvas.height = PORTRAIT_SIZE;
  const context = canvas.getContext("2d");
  if (context === null) {
    bitmap.close();
    throw new PortraitError("portraitUnreadable");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PORTRAIT_SIZE,
    PORTRAIT_SIZE,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY),
  );
  if (blob === null) throw new PortraitError("portraitUnreadable");
  return blob;
}
