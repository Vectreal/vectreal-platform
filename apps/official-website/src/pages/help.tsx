import { Link } from 'react-router';

import {
  Button,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@vctrl/shared/components';

import TitleSection from '../components/title-section';

const Help = () => {
  return (
    <>
      <TitleSection heading="Help">
        <div className="w-full max-w-2xl">
          <Accordion
            type="single"
            defaultValue="item-1"
            className="w-full"
            collapsible
          >
            <AccordionItem value="item-1">
              <AccordionTrigger>
                What file types are supported?
              </AccordionTrigger>
              <AccordionContent className="space-y-8">
                <div className="flex flex-col gap-2">
                  <p className="text-xl"> Supported import file types:</p>
                  <p className="text-muted-foreground">
                    .usdz (USDA), .gltf, .glb, .obj
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-xl ">Supported export file types:</p>
                  <div className="flex flex-col gap-4 text-muted-foreground">
                    <span>
                      <p>Free tier</p>
                      <p> .usdz (USDA) .glb (glTF)</p>
                    </span>
                    <span>
                      <p>Pro tier</p>
                      <p>.usdz (USDC | Apple), .gltf + textures, .obj</p>
                    </span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Can I use the tool for free?</AccordionTrigger>
              <AccordionContent>
                Yes. Using the free tier is completely free.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>
                Do I have to register an account?
              </AccordionTrigger>
              <AccordionContent>
                No. You will only need an account to export and save files.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </TitleSection>
      <section className="flex items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-8 text-center max-w-xl min-h-[40rem]">
          <h2 className="text-4xl font-bold tracking-tight">
            Still have a question?
          </h2>
          <p className="text-muted-foreground">
            We&apos;re here to help. If you have a question or comment, please
            reach out to us.
            <br />
            Either use our contact form or get in contact using social media.
          </p>
          <span className="flex flex-row gap-4 items-center">
            <Link to="/contact">
              <Button>Get in touch</Button>
            </Link>
            <Link
              to="mailto:info@vectreal.com"
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline">info@vectreal.com</Button>
            </Link>
          </span>
        </div>
      </section>
    </>
  );
};

export default Help;
