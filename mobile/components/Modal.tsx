import ReactNativeModal, { ModalProps } from "react-native-modal";
import { ReactNode } from "react";

type Props = Partial<ModalProps> & { isVisible: boolean; children?: ReactNode };

export default function Modal({ children, ...props }: Props) {
  // @ts-ignore — children incompatibility between react-native-modal and React 19 types
  return <ReactNativeModal {...props}>{children}</ReactNativeModal>;
}
