import { parsePartyImagePath } from "../../../shared/party-images.js";
import { fetchPartyProgrammingImage } from "../../pages/party/partyApi.js";

export async function resolvePartyPreviewImages(html, roomId, token) {
  const document = new DOMParser().parseFromString(String(html || ""), "text/html");
  const images = [...document.querySelectorAll("img[src]")];
  const requests = new Map();
  for (const image of images) {
    const source = image.getAttribute("src");
    const asset = parsePartyImagePath(source);
    if (!asset) continue;
    if (!requests.has(source)) requests.set(source, fetchPartyProgrammingImage(roomId, asset.id, token));
  }
  const resolved = new Map(await Promise.all([...requests].map(async ([source, request]) => {
    const result = await request;
    return [source, result.dataUrl];
  })));
  for (const image of images) {
    const dataUrl = resolved.get(image.getAttribute("src"));
    if (dataUrl) image.setAttribute("src", dataUrl);
  }
  return document.body.innerHTML;
}
