import Image from "next/image";
import Link from "next/link";

const Logo: React.FC = () => {
  return (
    <Link href="/" aria-label="Swippable home">
      <Image
        src="/images/logo/logo.svg"
        alt="Swippable"
        width={330}
        height={96}
        priority
        className="h-9 w-auto sm:h-10"
      />
    </Link>
  );
};

export default Logo;
