/**
 * External dependencies
 */
import uaParser from 'ua-parser-js';

/**
 * Internal dependencies
 */
import { getLogger } from 'server/lib/logger';
import config from 'config';

const NS_TO_MS = 1e-6;

const parseUA = ( rawUA ) => {
	const parsedUA = uaParser( rawUA );
	if ( parsedUA.browser.name && parsedUA.browser.version ) {
		const version = parsedUA.browser.version.split( '.' )[ 0 ];
		return `${ parsedUA.browser.name } ${ version }`;
	}
	return rawUA;
};

const logRequest = ( req, res, options ) => {
	const { requestStart, env, version } = options;

	const fields = {
		method: req.method,
		status: res.statusCode,
		length: res.get( 'content-length' ),
		url: req.originalUrl,
		duration: Number(
			( Number( process.hrtime.bigint() - requestStart ) * NS_TO_MS ).toFixed( 3 )
		),
		httpVersion: req.httpVersion,
		version,
		env,
		userAgent: parseUA( req.get( 'user-agent' ) ),
		rawUserAgent: req.get( 'user-agent' ),
		remoteAddr: req.ip,
		referrer: req.get( 'referer' ),
	};

	req.logger.info( fields );
};

export default () => {
	const logger = getLogger();
	const env = config( 'env_id' );
	const version = process.env.COMMIT_SHA;

	return ( req, res, next ) => {
		req.logger = logger;
		const requestStart = process.hrtime.bigint();
		res.on( 'finish', () => logRequest( req, res, { requestStart, env, version } ) );
		next();
	};
};
