/**
 * External dependencies
 */
import { connect } from 'react-redux';
import { find, get, groupBy } from 'lodash';
import { localize } from 'i18n-calypso';
import PropTypes from 'prop-types';
import React from 'react';

/**
 * Internal dependencies
 */
import { Button, CompactCard } from '@automattic/components';
import { CALYPSO_CONTACT } from 'lib/url/support';
import { composeAnalytics, recordGoogleEvent, recordTracksEvent } from 'state/analytics/actions';
import { emailManagementAddGSuiteUsers } from 'my-sites/email/paths';
import { hasPendingGSuiteUsers } from 'lib/gsuite';
import { getCurrentUser } from 'state/current-user/selectors';
import { getSelectedDomain } from 'lib/domains';
import { getSelectedSiteSlug } from 'state/ui/selectors';
import GSuiteUserItem from 'my-sites/email/email-management/gsuite-user-item';
import Notice from 'components/notice';
import PendingGSuiteTosNotice from 'my-sites/domains/components/domain-warnings/pending-gsuite-tos-notice';
import SectionHeader from 'components/section-header';
import { withLocalizedMoment } from 'components/localized-moment';
import { hasTitanMailWithUs } from 'calypso/lib/titan/has-titan-mail-with-us';
import TitanControlPanelLoginCard from 'calypso/my-sites/email/email-management/titan-control-panel-login-card';

/**
 * Style dependencies
 */
import './style.scss';

class GSuiteUsersCard extends React.Component {
	canAddUsers( domainName ) {
		return this.props.domainsAsList.some(
			( domain ) =>
				domain &&
				domain.name === domainName &&
				get( domain, 'googleAppsSubscription.ownedByUserId' ) === this.props.user.ID
		);
	}

	isNewUser( user, subscribedDate ) {
		return this.props.moment().subtract( 1, 'day' ).isBefore( subscribedDate );
	}

	generateClickHandler( user ) {
		return () => {
			this.props.manageClick( user.domain, user.email );
		};
	}

	goToAddGoogleApps = () => {
		this.props.addGoogleAppsUserClick( this.props.selectedDomainName );
	};

	renderDomainWithGSuite( domainName, users ) {
		// The product name is same for all users as product license is associated to domain
		// Hence a snapshot of the product name from the first user is sufficient
		const license = users[ 0 ].product_name;
		// This ensures display consistency if the API is not ready yet
		const label = license ? `${ license }: ${ domainName }` : domainName;
		return (
			<div key={ `google-apps-user-${ domainName }` } className="gsuite-users-card__container">
				<SectionHeader label={ label }>
					{ this.canAddUsers( domainName ) && (
						<Button
							primary
							compact
							href={ emailManagementAddGSuiteUsers( this.props.selectedSiteSlug, domainName ) }
							onClick={ this.goToAddGoogleApps }
						>
							{ this.props.translate( 'Add New User' ) }
						</Button>
					) }
				</SectionHeader>
				<CompactCard className="gsuite-users-card__user-list">
					<ul className="gsuite-users-card__user-list-inner">
						{ users.map( ( user, index ) => this.renderUser( user, index ) ) }
					</ul>
				</CompactCard>
			</div>
		);
	}

	renderDomain( domain, users ) {
		if ( hasTitanMailWithUs( domain ) ) {
			return <TitanControlPanelLoginCard domain={ domain } key={ `titan-${ domain.name }` } />;
		}

		return this.renderDomainWithGSuite( domain.name, users );
	}

	renderUser( user, index ) {
		if ( user.error ) {
			let status = 'is-warning',
				text = user.error,
				supportLink = (
					<a href={ CALYPSO_CONTACT }>
						<strong>{ this.props.translate( 'Please contact support' ) }</strong>
					</a>
				);

			const domain = find( this.props.domains, { name: user.domain } );
			const subscribedDate = get( domain, 'googleAppsSubscription.subscribedDate', false );
			if ( subscribedDate ) {
				if ( this.isNewUser( user, subscribedDate ) ) {
					status = null;
					text = this.props.translate(
						'We are setting up %(email)s for you. It should start working immediately, but may take up to 24 hours.',
						{ args: { email: user.email } }
					);
					supportLink = null;
				}
			}

			return (
				<Notice
					key={ `google-apps-user-notice-${ user.domain }-${ index }` }
					showDismiss={ false }
					status={ status }
				>
					{ text } { supportLink }
				</Notice>
			);
		}

		return (
			<GSuiteUserItem
				key={ `google-apps-user-${ user.domain }-${ index }` }
				user={ user }
				onClick={ this.generateClickHandler( user ) }
				siteSlug={ this.props.selectedSiteSlug }
			/>
		);
	}

	render() {
		const { domainsAsList, gsuiteUsers, selectedSiteSlug } = this.props;
		const pendingDomains = domainsAsList.filter( hasPendingGSuiteUsers );
		const usersByDomain = groupBy( gsuiteUsers, 'domain' );

		return (
			<div>
				{ pendingDomains.length !== 0 && (
					<PendingGSuiteTosNotice
						key="pending-gsuite-tos-notice"
						siteSlug={ selectedSiteSlug }
						domains={ pendingDomains }
						section="gsuite-users-manage-notice"
					/>
				) }

				{ domainsAsList
					.filter( ( domain ) => domain.name in usersByDomain || hasTitanMailWithUs( domain ) )
					.map( ( domain ) => this.renderDomain( domain, usersByDomain[ domain.name ] ) ) }
			</div>
		);
	}
}

const addGoogleAppsUserClick = ( domainName ) =>
	composeAnalytics(
		recordGoogleEvent(
			'Domain Management',
			'Clicked "Add New User" Button in G Suite',
			'Domain Name',
			domainName
		),

		recordTracksEvent( 'calypso_domain_management_gsuite_add_gsuite_user_click', {
			domain_name: domainName,
		} )
	);

const manageClick = ( domainName, email ) =>
	composeAnalytics(
		recordGoogleEvent(
			'Domain Management',
			'Clicked "Manage" link in G Suite',
			'User Email',
			email
		),

		recordTracksEvent( 'calypso_domain_management_gsuite_manage_click', {
			domain_name: domainName,
			email,
		} )
	);

GSuiteUsersCard.propTypes = {
	domains: PropTypes.array.isRequired,
	gsuiteUsers: PropTypes.array.isRequired,
	selectedDomainName: PropTypes.string,
	selectedSiteSlug: PropTypes.string.isRequired,
	user: PropTypes.object.isRequired,
};

export default connect(
	( state, ownProps ) => {
		const domainsList = ownProps.selectedDomainName
			? [ getSelectedDomain( ownProps ) ]
			: ownProps.domains;
		return {
			selectedSiteSlug: getSelectedSiteSlug( state ),
			user: getCurrentUser( state ),
			domainsAsList: domainsList,
		};
	},
	{ addGoogleAppsUserClick, manageClick }
)( localize( withLocalizedMoment( GSuiteUsersCard ) ) );
