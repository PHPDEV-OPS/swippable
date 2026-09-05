import Image from "next/image";
import Link from "next/link";

const Logo: React.FC = () => {
  return (
    <Link href="/">
      <Image
        src="/images/logo/logo.svg"
        alt="logo"
        width={480}
        height={112}
        className="w-[480px] h-[112px]"
        style={{ width: "auto", height: "auto", maxWidth: "480px", maxHeight: "112px" }}
        quality={100}
      />
    </Link>
  );
};

export default Logo;
