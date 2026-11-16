import { Layers } from "lucide-react";
import PortalDialog from "./PortalDialog";

/** Shared centered modal for the user portal. */
export default function Modal({ title, onClose, children, maxWidth = "max-w-md" }) {
  return <PortalDialog title={title} onClose={onClose} maxWidth={maxWidth} icon={<Layers className="h-5 w-5" />} closeOnBackdrop collapseOnStatus={false}>
    {children}
  </PortalDialog>;
}
