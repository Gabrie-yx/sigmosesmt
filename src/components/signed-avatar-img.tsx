// Drop-in <img> pro bucket `avatars` — assina a URL sob demanda.
// Use no lugar de `<img src={emp.foto_url}>` sempre que a origem for uma
// foto de colaborador vinda do bucket privado.

import { forwardRef, type ImgHTMLAttributes } from "react";
import { useSignedAvatarUrl } from "@/lib/signed-avatar-url";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
};

export const SignedAvatarImg = forwardRef<HTMLImageElement, Props>(
  function SignedAvatarImg({ src, alt = "", ...rest }, ref) {
    const signed = useSignedAvatarUrl(src);
    if (!signed) return null;
    return <img ref={ref} src={signed} alt={alt} {...rest} />;
  },
);