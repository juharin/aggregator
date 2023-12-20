import Link from 'next/link';
import { useState, useEffect, ReactNode } from 'react';

import LoadingDots from 'components/ui/LoadingDots';
import Button from 'components/ui/Button';
import { useUser } from 'utils/useUser';
import { postData } from 'utils/helpers';
import { updatePolarAccessToken, updatePolarTokenExpiresIn } from '@/utils/supabase-client';
import { User } from '@supabase/supabase-js';
//import { withPageAuth } from '@supabase/auth-helpers-nextjs';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
//import { GetServerSidePropsContext } from 'next'
//import supabase from 'utils/supabase-browser';
//import createClient from 'utils/supabase-server';

interface Props {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}

function Card({ title, description, footer, children }: Props) {
  return (
    <div className="border border-zinc-700	max-w-3xl w-full p rounded-md m-auto my-8">
      <div className="px-5 py-4">
        <h3 className="text-2xl mb-1 font-medium">{title}</h3>
        <p className="text-zinc-300">{description}</p>
        {children}
      </div>
      <div className="border-t border-zinc-700 bg-zinc-900 p-4 text-zinc-500 rounded-b-md">
        {footer}
      </div>
    </div>
  );
}

//export const getServerSideProps = withPageAuth({ redirectTo: '/signin' });

export async function getServerSideProps(/*{ req, res, query }*/ctx) {

  const serverSupabaseClient = createServerSupabaseClient(ctx);
  //const { req, res, query } = ctx;
  // Create authenticated Supabase Client
  //const supabase = createPagesServerClient(ctx);
  // Check if we have a session
  const {
    data: { session },
  } = await serverSupabaseClient.auth.getSession();

  if (!session) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }

  const { data: userData, error } = await serverSupabaseClient
    .from('users')
    .select('*')
    .eq('id', session.user.id);
  
  if (error) {
    console.log(error.message);
  }
  
    // extract authorization code 'code' from request params and get access token
  //const authCode = req.headers.searchParams["code"];
  const authCode = ctx.query ? ctx.query.code : null;
  const storedAccessToken = userData?.at(0).polar_access_token || null;
  console.log('Users stored Polar access token: %s', storedAccessToken);
  let data = {};

  // get access token
  if (authCode && !storedAccessToken) {
    console.log('Polar authorized (%s), getting access token', authCode);
    let authCredentials = new Buffer("1da146c8-b5a5-4b75-8f90-ce77efd5a120:ae1e9c36-11fa-42d2-ba15-0c763044e643");
    let base64Data = authCredentials.toString('base64');
    const requestBody = {
      "grant_type": "authorization_code",
      "code": authCode,
    };
    const authResponse = await fetch(`https://polarremote.com/v2/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + base64Data,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json;charset=UTF-8"
      },
      body: new URLSearchParams(requestBody),
    });
    data = await authResponse.json();
  }

  let polarUserData = {};
  if (data.access_token && !storedAccessToken) {
    console.log('Got access token (%s), registering user', data.access_token);
    /*const registerResponse = await fetch(`https://www.polaraccesslink.com/v3/users`, {
      method: "POST",
      mode: "no-cors", // no-cors, *cors, same-origin
      headers: {
        "Authorization": "Bearer " + data.access_token,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: {
        "member-id": "aggre_" + data.x_user_id,
      },
    });
    polarUserData = await registerResponse.json();*/
    const requestBody = {
      "member-id": "aggre_" + data.x_user_id,
    };
    fetch(`https://www.polaraccesslink.com/v3/users`, {
        method: "POST",
        mode: "no-cors", // no-cors, *cors, same-origin
        headers: new Headers({
          "Authorization": "Bearer " + data.access_token,
          "Content-Type": "application/json",
          "Accept": "application/json",
        }),
        body: JSON.stringify(requestBody),
      }
    ).then(function(registerResponse) {
      console.log('Registering returned %d', registerResponse.status);
      if (registerResponse.ok) {
        polarUserData = registerResponse.json();
      }
    }).then(function(body) {
      console.log(body);
    });
  }

  // Pass data to the page via props
  return { 
    props: { 
      initialSession: session,
      user: session.user, 
      data,
      polarUserData,
      storedAccessToken,
    } 
  }
}

export default function Account(
  { user, data, polarUserData, storedAccessToken }: 
  { user: User, data: {}, polarUserData: {}, storedAccessToken: string }
) {
  const [loading, setLoading] = useState(false);
  const [polarConnected, setPolarConnected] = useState(false);
  const { isLoading, subscription, userDetails } = useUser();
  
  useEffect(() => {
    if (!polarConnected) {
      console.log('Checking users Polar access token (%s), setting state', storedAccessToken);
      setPolarConnected(storedAccessToken ? true : false);
    }
  }, []);

  useEffect(() => {
    if (data.access_token && !polarConnected) {
      console.log('Got Polar authorization data (%s), storing to DB', data.access_token);
      setPolarConnected(data.access_token ? true : false);
      // TODO: Should handle these in the server?
      const { 
        access_token: accessToken = null, 
        expires_in: expiresIn = null, 
        x_user_id: polarId = null 
      } = data;
      // TODO: Should do this in the server?
      const polarExpiresIn = new Date((((new Date()).getTime() / 1000) + expiresIn) * 1000);
      //const userBefore = await getUser(session.user);
      if (accessToken) {
        updatePolarAccessToken(user, accessToken)
        .then(function(userData) {
          const userWithToken = userData;
        }).then(function(body) {
          console.log(body);
        });
      }
      if (polarExpiresIn) {
        updatePolarTokenExpiresIn(user, polarExpiresIn)
        .then(function(userData) {
          const userWithExpiration = userData;
        }).then(function(body) {
          console.log(body);
        });
      }
    }
  }, [data]);
  
  let getUserData = {};

  useEffect(() => {
    if (polarConnected && storedAccessToken) {
      console.log('Polar connected (%s), getting Polar user data for %d', storedAccessToken, data.x_user_id);
      fetch(`https://www.polaraccesslink.com/v3/users/29619815`, //${data.x_user_id}`,
      {
        method: 'GET',
        mode: "no-cors", // no-cors, *cors, same-origin
        headers: new Headers({
          "Authorization": "Bearer " + storedAccessToken,
          "Accept": "application/json",
        })
      })
      .then(function(res) {
        getUserData = res.json();
      }).then(function(body) {
        console.log(body);
      });
    };
  }, [polarConnected]);

  const redirectToCustomerPortal = async () => {
    setLoading(true);
    try {
      const { url, error } = await postData({
        url: '/api/create-portal-link'
      });
      window.location.assign(url);
    } catch (error) {
      if (error) return alert((error as Error).message);
    }
    setLoading(false);
  };

  const subscriptionPrice =
    subscription &&
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: subscription?.prices?.currency,
      minimumFractionDigits: 0
    }).format((subscription?.prices?.unit_amount || 0) / 100);

  return (
    <section className="bg-black mb-32">
      <div className="max-w-6xl mx-auto pt-8 sm:pt-24 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:flex-col sm:align-center">
          <h1 className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
            Account
          </h1>
          <p className="mt-5 text-xl text-zinc-200 sm:text-center sm:text-2xl max-w-2xl m-auto">
            We partnered with Stripe for a simplified billing.
          </p>
        </div>
      </div>
      <div className="p-4">
        <Card
          title="Your Plan"
          description={
            subscription
              ? `You are currently on the ${subscription?.prices?.products?.name} plan.`
              : ''
          }
          footer={
            <div className="flex items-start justify-between flex-col sm:flex-row sm:items-center">
              <p className="pb-4 sm:pb-0">
                Manage your subscription on Stripe.
              </p>
              <Button
                variant="slim"
                loading={loading}
                disabled={loading || !subscription}
                onClick={redirectToCustomerPortal}
              >
                Open customer portal
              </Button>
            </div>
          }
        >
          <div className="text-xl mt-8 mb-4 font-semibold">
            {isLoading ? (
              <div className="h-12 mb-6">
                <LoadingDots />
              </div>
            ) : subscription ? (
              `${subscriptionPrice}/${subscription?.prices?.interval}`
            ) : (
              <Link href="/">
                <a>Choose your plan</a>
              </Link>
            )}
          </div>
        </Card>
        <Card
          title="Your Connected Services"
          description="Activity and training data services you can connect to."
          footer={<p>Please connect all of your data sources.</p>}
        >
          <div className="text-xl mt-8 mb-4 font-semibold">
            {isLoading ? (
              <div className="h-12 mb-6">
                <LoadingDots />
              </div>
            ) : polarConnected ? (
              <>
                <p>Polar connected</p>
                <Link href="/">
                  <a>Disconnect Polar</a>
                </Link>
              </>
            ) : (
              <Link href="https://flow.polar.com/oauth2/authorization?response_type=code&client_id=1da146c8-b5a5-4b75-8f90-ce77efd5a120">
                <a>Connect Polar</a>
              </Link>
            )}
            <p>Polar user data</p>
            {data.x_user_id}
            <p>First name from polarUserData</p>
            {polarUserData["first-name"]}
            {polarUserData["member-id"]}
            <p>First name from getUserData</p>
            {getUserData["first-name"]}
            {getUserData.height}
          </div>
        </Card>
        <Card
          title="Your Name"
          description="Please enter your full name, or a display name you are comfortable with."
          footer={<p>Please use 64 characters at maximum.</p>}
        >
          <div className="text-xl mt-8 mb-4 font-semibold">
            {userDetails ? (
              `${
                userDetails.full_name ??
                `${userDetails.first_name} ${userDetails.last_name}`
              }`
            ) : (
              <div className="h-8 mb-6">
                <LoadingDots />
              </div>
            )}
          </div>
        </Card>
        <Card
          title="Your Email"
          description="Please enter the email address you want to use to login."
          footer={<p>We will email you to verify the change.</p>}
        >
          <p className="text-xl mt-8 mb-4 font-semibold">
            {user ? user.email : undefined}
          </p>
        </Card>
      </div>
    </section>
  );
}
