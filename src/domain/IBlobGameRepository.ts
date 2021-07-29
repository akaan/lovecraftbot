import { BlobGame } from "./BlobGame";

export interface IBlobGameRepository {
  nextId(): Promise<number>;
  get(id: number): Promise<BlobGame | undefined>;
  save(blobGame: BlobGame): Promise<void>;
  load(): Promise<BlobGame[]>;
}
