import ImageGenerationDesktopPage from "../desktop/ImageGenerationDesktopPage.jsx";
import "../../../styles/image-generation-mobile.css";

export default function ImageGenerationMobilePage() {
  return (
    <div className="image-mobile-shell" data-layout="mobile">
      <ImageGenerationDesktopPage />
    </div>
  );
}
