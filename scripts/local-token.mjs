// For the trusted launcher only: never write this output into application logs.
import {launchToken} from '../src/lib/local-store.ts';
process.stdout.write(launchToken());
