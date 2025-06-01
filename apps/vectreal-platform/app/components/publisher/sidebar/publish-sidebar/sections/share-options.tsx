import { Button } from '@vctrl-ui/ui/button';
import { Input } from '@vctrl-ui/ui/input';
import { Label } from '@vctrl-ui/ui/label';
import { Separator } from '@vctrl-ui/ui/separator';
import { motion } from 'framer-motion';
import { 
  Clipboard, 
  Facebook, 
  Link2, 
  Linkedin, 
  Mail, 
  QrCode, 
  Twitter
} from 'lucide-react';
import { useState } from 'react';

import { itemVariants } from '../../animation';

export const ShareOptions: React.FC = () => {
  const [shareLink, setShareLink] = useState('https://example.com/view/scene-id');
  const [copied, setCopied] = useState(false);
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
      });
  };

  const socialButtons = [
    { icon: <Twitter className="h-4 w-4" />, label: 'Twitter', color: 'bg-[#1DA1F2] hover:bg-[#1DA1F2]/90' },
    { icon: <Facebook className="h-4 w-4" />, label: 'Facebook', color: 'bg-[#1877F2] hover:bg-[#1877F2]/90' },
    { icon: <Linkedin className="h-4 w-4" />, label: 'LinkedIn', color: 'bg-[#0A66C2] hover:bg-[#0A66C2]/90' },
    { icon: <Mail className="h-4 w-4" />, label: 'Email', color: 'bg-zinc-700 hover:bg-zinc-700/90' }
  ];
  
  return (
    <motion.div 
      variants={itemVariants}
      className="space-y-4 px-2 py-2"
    >
      <div className="text-muted-foreground text-sm">
        Share your 3D scene with others through various channels
      </div>
      
      <div className="space-y-2">
        <Label className="text-sm">Share Link</Label>
        <div className="flex gap-2">
          <Input
            value={shareLink}
            onChange={(e) => setShareLink(e.target.value)}
            className="flex-1"
          />
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleCopyLink}
          >
            {copied ? <Clipboard className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
          </Button>
        </div>
        {copied && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-green-500 mt-1"
          >
            Link copied to clipboard!
          </motion.p>
        )}
      </div>
      
      <Separator className="my-4" />
      
      <div className="space-y-3">
        <Label className="text-sm">Share on Social Media</Label>
        <div className="grid grid-cols-2 gap-2">
          {socialButtons.map((btn, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className={`justify-start ${index > 1 ? 'mt-2' : ''}`}
            >
              <span className={`${btn.color} text-white p-1 rounded-md mr-2`}>
                {btn.icon}
              </span>
              {btn.label}
            </Button>
          ))}
        </div>
      </div>
      
      <div className="pt-2 flex justify-center">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="p-3 border rounded-md cursor-pointer"
        >
          <QrCode className="h-24 w-24 text-muted-foreground mx-auto" />
          <p className="text-xs text-center mt-2 text-muted-foreground">QR Code</p>
        </motion.div>
      </div>
    </motion.div>
  );
};