export interface ImageUploaderProps {
  setFile: React.Dispatch<React.SetStateAction<File | null>> | ((file: File) => void);
  file: File | null;
  allowedTypes: string[];
  close: () => void;
  maxSize: number;
  cropWidth: number;
  cropHeight: number;
}
