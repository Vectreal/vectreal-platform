import { Link } from 'react-router';

const Footer = () => (
  <footer className="flex flex-col gap-16 min-h-[20rem]">
    <div className="grid sm:grid-cols-3 gap-12 text-zinc-500">
      <div className="flex flex-col gap-4 text-center">
        <Link to="/">Home</Link>
        <Link to="/help">Help</Link>
      </div>
      <div className="flex flex-col gap-4 text-center">
        <Link to="/editor">Editor</Link>
        <Link to="https://vectreal.com" target="_blank">
          Vectreal
        </Link>
      </div>
      <div className="flex flex-col gap-4 text-center">
        <Link to="/">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
        <Link to="/contact">Contact</Link>
      </div>
    </div>
    <p className="text-center text-sm text-zinc-500 py-4">
      © 2024 All Rights Reserved - Vectreal Core
    </p>
  </footer>
);

export default Footer;
