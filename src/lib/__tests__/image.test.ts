import { ImageTooLargeError, NotAnImageError, fitWithin, prepareImage } from "../image";

const mockSave = jest.fn();
const mockResize = jest.fn();
const mockManipulate = jest.fn();
let mockFileSize = 1000;

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: { manipulate: (uri: string) => mockManipulate(uri) },
}));
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation(() => ({
    get size() {
      return mockFileSize;
    },
  })),
}));
jest.mock("expo-image-picker", () => ({}));

const asset = (extra: object = {}) =>
  ({ uri: "file:///a.heic", width: 4000, height: 3000, type: "image", mimeType: "image/heic", ...extra }) as never;

beforeEach(() => {
  mockFileSize = 1000;
  mockSave.mockReset().mockResolvedValue({ uri: "file:///out.jpg" });
  mockResize.mockReset();
  const rendered = { renderAsync: async () => ({ saveAsync: mockSave }) };
  mockManipulate.mockReset().mockReturnValue({
    resize: (size: object) => {
      mockResize(size);
      return rendered;
    },
    ...rendered,
  });
});

describe("fitWithin", () => {
  it("reduce el lado mayor a 1600", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600 });
    expect(fitWithin(3000, 4000)).toEqual({ height: 1600 });
  });
  it("no agranda lo pequeño", () => {
    expect(fitWithin(800, 600)).toEqual({});
  });
});

describe("prepareImage", () => {
  it("rechaza lo que no es imagen", async () => {
    await expect(prepareImage(asset({ type: "video" }))).rejects.toBeInstanceOf(NotAnImageError);
    await expect(prepareImage(asset({ mimeType: "application/pdf" }))).rejects.toBeInstanceOf(NotAnImageError);
  });

  it("reduce y devuelve un JPEG", async () => {
    const result = await prepareImage(asset());
    expect(mockResize).toHaveBeenCalledWith({ width: 1600 });
    expect(result).toMatchObject({ uri: "file:///out.jpg", type: "image/jpeg" });
  });

  it("si pesa más de 10 MB baja la calidad y, si no alcanza, avisa", async () => {
    mockFileSize = 11 * 1024 * 1024;
    await expect(prepareImage(asset())).rejects.toBeInstanceOf(ImageTooLargeError);
    expect(mockSave).toHaveBeenCalledTimes(3);
  });
});
