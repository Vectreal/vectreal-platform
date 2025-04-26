import { FormEvent } from 'react';
import { Link } from 'react-router';

import { Button, Input, Label, Textarea } from '@vctrl/shared/components';

import TitleSection from '../components/title-section';

const Contact = () => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log('Form submitted');

    const formData = new FormData(event.currentTarget as HTMLFormElement);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const data = Object.fromEntries(formData.entries());
  };

  return (
    <TitleSection heading="Contact">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <p className="text-xl text-muted-foreground">
          We&apos;d love to hear from you. Please fill out the form below and
          we&apos;ll get back to you as soon as possible.
        </p>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Label htmlFor="name">Name</Label>
          <Input
            type="text"
            name="name"
            id="name"
            placeholder="What's your name?"
            className="input"
          />

          <Label htmlFor="email">Email</Label>
          <Input
            type="email"
            name="email"
            id="email"
            placeholder="What's your email?"
            className="input"
          />

          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            name="message"
            placeholder="What would you like to say?"
            className="textarea"
            rows={4}
          />
          <Button type="submit" className="w-full">
            Send message
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          Or write an email to:{' '}
          <Link
            className="text-zinc-100 hover:underline"
            to="mailto:info@vectreal.com"
          >
            info@vectreal.com
          </Link>{' '}
          /{' '}
          <Link
            className="text-zinc-100 hover:underline"
            to="mailto:moritz@vectreal.com"
          >
            ken@vectreal.com
          </Link>{' '}
          ( or reach us via our{' '}
          <Link
            to="https://discord.gg/A9a3nPkZw7"
            target="_blank"
            className="text-zinc-100 hover:underline"
          >
            Discord Server
          </Link>{' '}
          ^^)
        </p>
      </div>
    </TitleSection>
  );
};

export default Contact;
