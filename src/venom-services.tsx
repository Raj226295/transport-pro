import { createRoot } from "react-dom/client";
import VenomButton from "./components/VenomButton";

const mount = document.getElementById("services-venom-root");

if (mount) {
  createRoot(mount, { identifierPrefix: "services-" }).render(<VenomButton id="open-services" text="Our services" width={190} height={54} className="services-venom-button" aria-haspopup="dialog" aria-controls="services-app" onClick={() => document.dispatchEvent(new CustomEvent("services:open"))} />);
}
