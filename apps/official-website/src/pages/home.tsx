import { Suspense } from 'react';
import { Link } from 'react-router';
import {
  EyeOpenIcon,
  GitHubLogoIcon,
  ImageIcon,
  Pencil2Icon,
  UpdateIcon,
} from '@radix-ui/react-icons';

import {
  Highlight,
  BackgroundBeams,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DefaultSpinner,
} from '@vctrl/shared/components';

import { sendCustomEvent } from '../lib/utils/ga-utils';
import { useIsMobile } from '../lib/hooks';

import reactGraphic from '../components/assets/react-graphic.png';
import TypographyMuted from '../components/typography/typography-muted';
import TypographyLead from '../components/typography/typography-lead';
import ModelScene from '../components/title-model-scene';

const featureContent = [
  {
    icon: <EyeOpenIcon className="w-6 h-6 mb-4" />,
    title: 'React 3D Viewer',
    description:
      'A seamless 3D viewing experience, right in your browser. Perfect for showcasing and interacting with 3D models in real time.',
  },
  {
    icon: <UpdateIcon className="w-6 h-6 mb-4" />,
    title: 'Load and Convert',
    description:
      'Effortlessly convert 3D models into optimized, React-compatible formats. Use our tools or react-hooks for fast loading and smooth interactions in any React app.',
  },
  {
    icon: <ImageIcon className="w-6 h-6 mb-4" />,
    title: 'Docker Images',
    description:
      'Deploy Vectreal tools in your workflow quickly and efficiently with our Docker images. Designed to integrate seamlessly into your docker environment, making 3D content transformations hassle-free.',
  },
];

const Home = () => {
  const isMobile = useIsMobile();

  return (
    <>
      {!isMobile && <BackgroundBeams className="absolute z-0" />}
      <section className="flex flex-col items-center my-48 relative z-10">
        <div className="flex flex-col items-center gap-8 text-center max-w-2xl">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Engineered for Speed, Designed for Quality
          </h1>
          <h4 className="md:text-2xl text-muted-foreground !leading-[2.5rem]">
            Built on open principles for{' '}
            <Highlight>faster load times</Highlight> and stunning results with
            Vectreal's community-driven tools.
          </h4>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/editor"
              onClick={() =>
                sendCustomEvent({
                  category: 'Home Page',
                  action: 'click',
                  label: 'Hero Section - Open Editor',
                })
              }
            >
              <Button>
                <Pencil2Icon className="mr-3" /> Get Started with Our Editor
              </Button>
            </Link>
            <Link
              to="https://github.com/vectreal/vectreal-core"
              target="_blank"
              onClick={() =>
                sendCustomEvent({
                  category: 'Home Page',
                  action: 'click',
                  label: 'Hero Section - GitHub',
                })
              }
            >
              <Button variant="outline">
                <GitHubLogoIcon className="mr-3" /> Join Our Community on GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-8 items-center relative z-10 my-32">
        <div className="grid md:grid-cols-2 gap-8 max-w-screen-xl">
          <div className="flex flex-col gap-8 justify-center">
            <h2 className="text-4xl font-bold tracking-tight">Our Mission</h2>
            <TypographyMuted>
              Welcome to Vectreal Core, your go-to destination for open-source
              3D tools optimized for React. Our mission is to provide
              developers, designers, and creators with the resources they need
              to integrate high-performance 3D content into React-based
              projects.
            </TypographyMuted>
            <TypographyLead>
              Starting with a strong focus on React
            </TypographyLead>
            <TypographyMuted>
              Vectreal's proprietary platform will soon expand to offer powerful
              solutions for a variety of web technologies. However, our current
              priority is supporting the React community with the best tools and
              resources for building interactive 3D experiences.
            </TypographyMuted>
          </div>

          <Card className="h-[50vh] max-h-[500px] w-full overflow-hidden border-zinc-700">
            <CardHeader className="p-3 border-b bg-zinc-900">
              <span className="flex flex-row items-center gap-[12px]">
                <div className="w-3 h-3 rounded-full bg-zinc-600 m-0" />
                <div className="w-3 h-3 rounded-full bg-zinc-600 m-0" />
                <div className="w-3 h-3 rounded-full bg-zinc-600 m-0" />
              </span>
            </CardHeader>
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <DefaultSpinner />
                </div>
              }
            >
              <ModelScene url="/assets/vans-shoe.glb" />
            </Suspense>
          </Card>
        </div>
      </section>

      <section className="flex flex-col items-center gap-8 relative z-10 my-32">
        <div className="max-w-screen-xl">
          <h2 className="text-4xl font-bold tracking-tight mb-8">The Core</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {featureContent.map((feature, index) => (
              <Card className="bg-background" key={index}>
                <CardHeader>
                  {feature.icon}
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center gap-8 relative z-10 my-32">
        <h2 className="text-4xl font-bold tracking-tight text-center">
          Try it out for yourself
        </h2>
        <TypographyMuted className="text-center">
          Test the power of our tools right here using our free online editor
          toolkit.
        </TypographyMuted>
        <Link
          to="/editor"
          onClick={() =>
            sendCustomEvent({
              category: 'Home Page',
              action: 'click',
              label: 'CTA - Open Editor',
            })
          }
        >
          <Button>
            <Pencil2Icon className="mr-3" /> Open the Editor
          </Button>
        </Link>
      </section>

      <section className="flex flex-col gap-8 items-center relative z-10 my-32">
        <div className="grid max-md:flex max-md:flex-col-reverse md:grid-cols-2 gap-8 max-w-screen-xl">
          <div className="flex flex-col gap-8 justify-center">
            <h2 className="text-4xl font-bold tracking-tight">
              Why Vectreal for React?
            </h2>
            <TypographyMuted>
              Vectreal Core is built with React developers in mind. Whether
              you're working on e-commerce, portfolios, or web apps, our tools
              integrate seamlessly with your React projects. We prioritize
              simplicity and efficiency, making sure you can focus on creating
              stunning 3D experiences without extra complexity.
            </TypographyMuted>
            <TypographyMuted>
              We're expanding soon! Our proprietary Vectreal platform will cater
              to a wider range of web technologies, so stay tuned as we roll out
              new features for developers working with different frameworks.
            </TypographyMuted>
          </div>
          <img src={reactGraphic} alt="" />
        </div>
      </section>

      <section className="flex flex-col gap-8 items-center relative z-10 my-32">
        <div className="flex flex-col-reverse md:grid md:grid-cols-4 gap-8 max-w-screen-xl">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Contribute on GitHub</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col justify-between grow">
              <CardDescription>
                Learn how to contribute to our project on GitHub. We’re always
                looking for passionate contributors who can help build the
                future of 3D web content.
              </CardDescription>
              <Link
                to="https://github.com/vectreal"
                target="_blank"
                className="mt-4"
                onClick={() =>
                  sendCustomEvent({
                    category: 'Home Page',
                    action: 'click',
                    label: 'Collaboration - GitHub',
                  })
                }
              >
                <Button>Visit GitHub</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Join the discussion on Discord</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col justify-between grow">
              <CardDescription>
                Join our Discord server for support, discussions, and
                collaboration. Help shape the future of 3D web content!
              </CardDescription>
              <Link
                to="https://discord.gg/A9a3nPkZw7"
                target="_blank"
                className="mt-4"
                onClick={() =>
                  sendCustomEvent({
                    category: 'Home Page',
                    action: 'click',
                    label: 'Collaboration - Discord',
                  })
                }
              >
                <Button>Join Discord</Button>
              </Link>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-8 col-span-2 justify-center">
            <h2 className="text-4xl font-bold tracking-tight">
              Built on Collaboration
            </h2>
            <TypographyMuted>
              At Vectreal, collaboration is at the core of what we do. Join a
              community of developers, designers, and creators working together
              to push the boundaries of 3D web content.
            </TypographyMuted>
            <TypographyMuted>
              Stay tuned as we expand beyond React to cater to a wider range of
              web technologies. Let's build the future of 3D together.
            </TypographyMuted>
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;
