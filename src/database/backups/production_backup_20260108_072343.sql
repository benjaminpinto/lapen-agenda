--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    match_id integer NOT NULL,
    player_name character varying(255) NOT NULL,
    amount numeric(10,2) NOT NULL,
    potential_return numeric(10,2),
    status character varying(20) DEFAULT 'active'::character varying,
    payment_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bets_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'won'::character varying, 'lost'::character varying, 'refunded'::character varying])::text[])))
);


--
-- Name: bets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bets_id_seq OWNED BY public.bets.id;


--
-- Name: challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenges (
    id integer NOT NULL,
    challenger_id integer NOT NULL,
    challenged_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    start_date date NOT NULL,
    end_date date NOT NULL,
    target_type character varying(20) NOT NULL,
    target_amount integer,
    prize_comment text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT challenges_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'rejected'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT challenges_target_type_check CHECK (((target_type)::text = ANY ((ARRAY['victories'::character varying, 'balance'::character varying, 'sets'::character varying])::text[])))
);


--
-- Name: challenges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.challenges_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: challenges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.challenges_id_seq OWNED BY public.challenges.id;


--
-- Name: courts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courts (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(100) NOT NULL,
    description text,
    active boolean DEFAULT true,
    image_url text
);


--
-- Name: courts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.courts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: courts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.courts_id_seq OWNED BY public.courts.id;


--
-- Name: holidays_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holidays_blocks (
    id integer NOT NULL,
    date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    description text
);


--
-- Name: holidays_blocks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.holidays_blocks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: holidays_blocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.holidays_blocks_id_seq OWNED BY public.holidays_blocks.id;


--
-- Name: match_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_results (
    id integer NOT NULL,
    match_id integer NOT NULL,
    winner_name character varying(255) NOT NULL,
    score character varying(100),
    finished_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    settled boolean DEFAULT false,
    total_winnings numeric(10,2)
);


--
-- Name: match_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.match_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: match_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.match_results_id_seq OWNED BY public.match_results.id;


--
-- Name: match_statistics_unified; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_statistics_unified (
    id integer NOT NULL,
    schedule_id integer,
    ranking_match_id integer,
    player1_id integer,
    player2_id integer,
    player1_name character varying(255) NOT NULL,
    player2_name character varying(255) NOT NULL,
    winner_id integer,
    winner_name character varying(255) NOT NULL,
    score text NOT NULL,
    match_type character varying(50) NOT NULL,
    match_date date NOT NULL,
    season_id integer,
    added_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT match_statistics_unified_check CHECK (((schedule_id IS NOT NULL) OR (ranking_match_id IS NOT NULL))),
    CONSTRAINT match_statistics_unified_check1 CHECK (((schedule_id IS NULL) OR (ranking_match_id IS NULL)))
);


--
-- Name: match_statistics_unified_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.match_statistics_unified_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: match_statistics_unified_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.match_statistics_unified_id_seq OWNED BY public.match_statistics_unified.id;


--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id integer NOT NULL,
    schedule_id integer NOT NULL,
    status character varying(20) DEFAULT 'upcoming'::character varying,
    betting_enabled boolean DEFAULT true,
    total_pool numeric(10,2) DEFAULT 0.00,
    house_edge numeric(3,2) DEFAULT 0.20,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT matches_status_check CHECK (((status)::text = ANY ((ARRAY['upcoming'::character varying, 'live'::character varying, 'finished'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: matches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.matches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.matches_id_seq OWNED BY public.matches.id;


--
-- Name: payment_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_logs (
    id integer NOT NULL,
    payment_id text NOT NULL,
    event_type text NOT NULL,
    status text NOT NULL,
    amount numeric(10,2),
    error_message text,
    metadata text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: payment_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_logs_id_seq OWNED BY public.payment_logs.id;


--
-- Name: ranking_draws; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ranking_draws (
    id integer NOT NULL,
    round_id integer NOT NULL,
    player1_id integer NOT NULL,
    player2_id integer NOT NULL,
    group_type character varying(20) NOT NULL,
    drawn_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: ranking_draws_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ranking_draws_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ranking_draws_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ranking_draws_id_seq OWNED BY public.ranking_draws.id;


--
-- Name: ranking_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ranking_matches (
    id integer NOT NULL,
    round_id integer NOT NULL,
    schedule_id integer,
    player1_id integer NOT NULL,
    player2_id integer NOT NULL,
    group_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'scheduled'::character varying,
    winner_id integer,
    score text,
    sets_p1 integer DEFAULT 0,
    sets_p2 integer DEFAULT 0,
    games_p1 integer DEFAULT 0,
    games_p2 integer DEFAULT 0,
    wo_type character varying(20) DEFAULT 'none'::character varying,
    points_p1 integer DEFAULT 0,
    points_p2 integer DEFAULT 0,
    played_at timestamp without time zone,
    added_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ranking_matches_group_type_check CHECK (((group_type)::text = ANY ((ARRAY['elite'::character varying, 'challenger'::character varying])::text[]))),
    CONSTRAINT ranking_matches_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'wo'::character varying])::text[]))),
    CONSTRAINT ranking_matches_wo_type_check CHECK (((wo_type)::text = ANY ((ARRAY['none'::character varying, 'admin'::character varying, 'forfeit'::character varying])::text[])))
);


--
-- Name: ranking_matches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ranking_matches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ranking_matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ranking_matches_id_seq OWNED BY public.ranking_matches.id;


--
-- Name: ranking_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ranking_participants (
    id integer NOT NULL,
    season_id integer NOT NULL,
    user_id integer NOT NULL,
    temp_points integer DEFAULT 0,
    total_points integer DEFAULT 0,
    wins integer DEFAULT 0,
    losses integer DEFAULT 0,
    sets_won integer DEFAULT 0,
    sets_lost integer DEFAULT 0,
    games_won integer DEFAULT 0,
    games_lost integer DEFAULT 0,
    wo_wins integer DEFAULT 0,
    wo_losses integer DEFAULT 0,
    "position" integer,
    is_active boolean DEFAULT true
);


--
-- Name: ranking_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ranking_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ranking_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ranking_participants_id_seq OWNED BY public.ranking_participants.id;


--
-- Name: ranking_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ranking_rounds (
    id integer NOT NULL,
    season_id integer NOT NULL,
    round_number integer NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    draw_date timestamp without time zone,
    description text,
    status character varying(20) DEFAULT 'pending'::character varying,
    is_finals boolean DEFAULT false,
    CONSTRAINT ranking_rounds_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'drawn'::character varying, 'open'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: ranking_rounds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ranking_rounds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ranking_rounds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ranking_rounds_id_seq OWNED BY public.ranking_rounds.id;


--
-- Name: ranking_season_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ranking_season_config (
    id integer NOT NULL,
    season_id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    data_type character varying(20) DEFAULT 'int'::character varying,
    CONSTRAINT ranking_season_config_data_type_check CHECK (((data_type)::text = ANY ((ARRAY['int'::character varying, 'float'::character varying, 'string'::character varying, 'boolean'::character varying])::text[])))
);


--
-- Name: ranking_season_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ranking_season_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ranking_season_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ranking_season_config_id_seq OWNED BY public.ranking_season_config.id;


--
-- Name: ranking_seasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ranking_seasons (
    id integer NOT NULL,
    year integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    description text DEFAULT ''::text,
    status character varying(20) DEFAULT 'draft'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ranking_seasons_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'finished'::character varying])::text[])))
);


--
-- Name: ranking_seasons_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ranking_seasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ranking_seasons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ranking_seasons_id_seq OWNED BY public.ranking_seasons.id;


--
-- Name: ranking_temp_points_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ranking_temp_points_rules (
    id integer NOT NULL,
    season_id integer NOT NULL,
    position_min integer NOT NULL,
    position_max integer NOT NULL,
    points integer NOT NULL,
    label character varying(100)
);


--
-- Name: ranking_temp_points_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ranking_temp_points_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ranking_temp_points_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ranking_temp_points_rules_id_seq OWNED BY public.ranking_temp_points_rules.id;


--
-- Name: recurring_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_schedules (
    id integer NOT NULL,
    court_id integer NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    description text,
    start_date date NOT NULL,
    end_date date NOT NULL
);


--
-- Name: recurring_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recurring_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recurring_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recurring_schedules_id_seq OWNED BY public.recurring_schedules.id;


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    revoked boolean DEFAULT false,
    device_info text
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    id integer NOT NULL,
    court_id integer NOT NULL,
    date date NOT NULL,
    start_time time without time zone NOT NULL,
    player1_name character varying(255) NOT NULL,
    player2_name character varying(255) NOT NULL,
    match_type character varying(50) NOT NULL,
    deleted_at timestamp without time zone,
    player1_id integer,
    player2_id integer
);


--
-- Name: schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedules_id_seq OWNED BY public.schedules.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(20),
    is_verified boolean DEFAULT false,
    verification_token character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_lapen_member boolean DEFAULT false,
    lapen_approved boolean DEFAULT false,
    lapen_requested_at timestamp without time zone,
    lapen_approved_at timestamp without time zone,
    lapen_approved_by integer,
    pix_key character varying(255),
    reset_token character varying(255),
    reset_token_expires timestamp without time zone,
    is_admin boolean DEFAULT false,
    short_name text,
    deleted_at timestamp without time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: bets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bets ALTER COLUMN id SET DEFAULT nextval('public.bets_id_seq'::regclass);


--
-- Name: challenges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges ALTER COLUMN id SET DEFAULT nextval('public.challenges_id_seq'::regclass);


--
-- Name: courts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courts ALTER COLUMN id SET DEFAULT nextval('public.courts_id_seq'::regclass);


--
-- Name: holidays_blocks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays_blocks ALTER COLUMN id SET DEFAULT nextval('public.holidays_blocks_id_seq'::regclass);


--
-- Name: match_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results ALTER COLUMN id SET DEFAULT nextval('public.match_results_id_seq'::regclass);


--
-- Name: match_statistics_unified id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_statistics_unified ALTER COLUMN id SET DEFAULT nextval('public.match_statistics_unified_id_seq'::regclass);


--
-- Name: matches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches ALTER COLUMN id SET DEFAULT nextval('public.matches_id_seq'::regclass);


--
-- Name: payment_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_logs ALTER COLUMN id SET DEFAULT nextval('public.payment_logs_id_seq'::regclass);


--
-- Name: ranking_draws id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_draws ALTER COLUMN id SET DEFAULT nextval('public.ranking_draws_id_seq'::regclass);


--
-- Name: ranking_matches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_matches ALTER COLUMN id SET DEFAULT nextval('public.ranking_matches_id_seq'::regclass);


--
-- Name: ranking_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_participants ALTER COLUMN id SET DEFAULT nextval('public.ranking_participants_id_seq'::regclass);


--
-- Name: ranking_rounds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_rounds ALTER COLUMN id SET DEFAULT nextval('public.ranking_rounds_id_seq'::regclass);


--
-- Name: ranking_season_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_season_config ALTER COLUMN id SET DEFAULT nextval('public.ranking_season_config_id_seq'::regclass);


--
-- Name: ranking_seasons id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_seasons ALTER COLUMN id SET DEFAULT nextval('public.ranking_seasons_id_seq'::regclass);


--
-- Name: ranking_temp_points_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_temp_points_rules ALTER COLUMN id SET DEFAULT nextval('public.ranking_temp_points_rules_id_seq'::regclass);


--
-- Name: recurring_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_schedules ALTER COLUMN id SET DEFAULT nextval('public.recurring_schedules_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules ALTER COLUMN id SET DEFAULT nextval('public.schedules_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: bets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bets (id, user_id, match_id, player_name, amount, potential_return, status, payment_id, created_at) FROM stdin;
18	1	13	Luciandre	1.00	0.00	lost	130046749697	2025-10-20 15:02:25.407618
22	1	13	Luciandre	1.00	0.00	lost	130048811855	2025-10-20 15:31:20.721482
23	1	13	Luciandre	1.00	0.00	lost	130048811855	2025-10-20 15:31:23.371845
10	1	10	Benjamin Pinto	1.00	0.00	lost	pi_3SJFmVE1cf0Sbfxq1ZCZ5j9a	2025-10-17 15:42:03.892629
1	1	5	Rafaella	10.00	0.00	lost	mock_pi_1760463099605	2025-10-14 17:31:42.235319
3	1	4	Barroso	1200.00	1760.00	won	mock_pi_1760466278267	2025-10-14 18:24:38.687902
2	2	4	Bruno Marinho	1000.00	800.00	lost	mock_pi_1760465719411	2025-10-14 18:15:19.710641
4	2	6	João Paulo 	500.00	400.00	refunded	mock_pi_1760522705696	2025-10-15 10:05:05.947501
5	1	6	Cascata Federer 	200.00	0.00	refunded	mock_pi_1760531727619	2025-10-15 12:35:27.941024
9	2	9	Bruno	500.00	0.00	refunded	mock_pi_1760639596215	2025-10-16 18:33:16.632491
6	2	7	Paulo Vinicius 	500.00	704.00	won	mock_pi_1760560224773	2025-10-15 20:30:25.232406
8	1	7	Raí	380.00	0.00	lost	mock_pi_1760636206465	2025-10-16 17:36:46.860553
24	1	12	Luciandre	1.00	0.00	lost	130346610241	2025-10-22 21:21:57.606633
13	1	12	Luciandre	1.00	0.00	lost	129864473203	2025-10-18 19:05:10.659057
25	2	14	Jp Duarte (Penedo)	30.00	39.00	won	131304961842	2025-10-25 22:26:16.031707
27	1	14	Jp Duarte (Penedo)	10.00	13.00	won	130806331099	2025-10-26 21:34:15.871236
26	2	14	Humberto (Arapiraca )	5.00	14.65	lost	130718381839	2025-10-25 22:32:18.951707
28	7	14	Humberto (Arapiraca )	10.00	29.30	lost	131468420270	2025-10-27 14:58:11.033048
29	7	14	Humberto (Arapiraca )	10.00	29.30	lost	131468420270	2025-10-27 14:58:12.701357
14	2	11	Fernando	30.00	38.88	won	129984607799	2025-10-19 20:56:21.657554
17	2	11	Fernando	20.00	25.92	won	130603734346	2025-10-20 09:48:26.387984
12	1	11	Rômulo Oliveira	1.00	1.57	lost	129864473203	2025-10-18 19:02:29.183397
15	3	11	Rômulo Oliveira	20.00	31.40	lost	130571504986	2025-10-19 22:22:05.80848
16	1	11	Rômulo Oliveira	10.00	15.70	lost	130016292377	2025-10-20 03:33:08.785216
\.


--
-- Data for Name: challenges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challenges (id, challenger_id, challenged_id, status, start_date, end_date, target_type, target_amount, prize_comment, created_at, updated_at) FROM stdin;
1	1	15	pending	2025-12-01	2025-12-31	victories	\N	Teste	2025-12-28 15:30:38.477096	2025-12-28 15:30:38.477096
2	2	3	active	2026-01-01	2026-06-30	victories	7	Um perfume a escolha do vencedor	2025-12-28 16:02:55.348419	2025-12-28 16:02:55.348419
\.


--
-- Data for Name: courts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.courts (id, name, type, description, active, image_url) FROM stdin;
1	Quadra 1	Saibro	Quadra da esquerda. Preferencial para aulas.	t	\N
2	Quadra 2	Saibro	Quadra da direita. Preferencial para jogos da liga.	t	\N
3	Quadra 3	Rápida	Quadra rápida.	t	\N
5	Quadra Externa	Saibro	Quadra externa para registrar eventos externos.	t	\N
\.


--
-- Data for Name: holidays_blocks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.holidays_blocks (id, date, start_time, end_time, description) FROM stdin;
\.


--
-- Data for Name: match_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.match_results (id, match_id, winner_name, score, finished_at, settled, total_winnings) FROM stdin;
1	5	Shirley 		2025-10-15 03:11:51.703137	t	8.00
2	4	Barroso		2025-10-15 03:12:22.869546	t	1760.00
3	7	Paulo Vinicius 		2025-10-18 18:30:37.672214	t	704.00
4	11	Fernando		2025-10-20 23:15:01.179767	t	64.80
5	13	João Paulo Brandão 		2025-10-22 21:13:49.896722	t	2.40
6	10	Renato Guedes		2025-10-22 21:14:00.972166	t	0.80
7	12	Benjamin 		2025-10-27 18:27:42.806325	t	1.60
8	14	Jp Duarte (Penedo)	6-2 6-1	2025-10-29 00:16:19.626313	t	52.00
\.


--
-- Data for Name: match_statistics_unified; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.match_statistics_unified (id, schedule_id, ranking_match_id, player1_id, player2_id, player1_name, player2_name, winner_id, winner_name, score, match_type, match_date, season_id, added_by, created_at) FROM stdin;
1	232	\N	1	\N	Benjamin Pinto	Gilberto	1	Benjamin Pinto	2-6, 7-6, 10-6	Amistoso	2025-12-09	\N	1	2025-12-10 13:25:03.758746
3	238	\N	16	\N	Neto Rezende	Joao Madero	16	Neto Rezende	6-2, 6-2	Amistoso	2025-12-10	\N	16	2025-12-11 12:12:46.791811
4	235	\N	23	\N	Henrique Soares 	Ângelo ( retorno aos treinos)	\N	Ângelo ( retorno aos treinos)	6-3, 2-6, 6-10	Amistoso	2025-12-11	\N	23	2025-12-11 22:42:09.618391
5	240	\N	1	3	Benjamin Pinto	Rômulo Oliveira 	3	Rômulo Oliveira 	0-6, 2-6	Amistoso	2025-12-11	\N	3	2025-12-12 14:41:50.176349
6	241	\N	2	3	Bruno Marinho 	Rômulo Oliveira 	2	Bruno Marinho 	4-6, 6-3, 13-11	Amistoso	2025-12-12	\N	2	2025-12-13 01:44:21.208027
2	220	\N	16	1	Neto Rezende	Benjamin Pinto	1	Benjamin Pinto	1-6, 1-6	Amistoso	2025-12-02	\N	1	2025-12-10 13:25:24.377859
7	247	\N	2	9	Bruno Marinho 	João Paulo Duarte	9	João Paulo Duarte	6-2, 1-6, 11-13	Amistoso	2025-12-15	\N	2	2025-12-16 00:42:42.33292
8	252	\N	1	8	Benjamin Pinto	Rafaella Moreira	1	Benjamin Pinto	6-3, 2-6, 10-2	Amistoso	2025-12-16	\N	1	2025-12-17 01:00:07.004269
9	262	\N	2	\N	Bruno Marinho 	Rai	2	Bruno Marinho 	7-5, 6-2	Amistoso	2025-12-17	\N	2	2025-12-18 00:07:51.17734
10	258	\N	1	3	Benjamin Pinto	Rômulo Oliveira 	3	Rômulo Oliveira 	0-6, 2-6	Amistoso	2025-12-18	\N	3	2025-12-19 01:18:20.959812
11	265	\N	2	10	Bruno Marinho 	Igor Lerner 	10	Igor Lerner 	2-6, 2-6	Amistoso	2025-12-19	\N	2	2025-12-19 23:46:27.364346
12	259	\N	2	23	Bruno Marinho 	Henrique Soares 	23	Henrique Soares 	2-6, 6-7	Amistoso	2025-12-22	\N	2	2025-12-23 00:14:47.224786
13	273	\N	2	\N	Bruno Marinho 	Rai	2	Bruno Marinho 	6-2, 0-6, 10-6	Amistoso	2025-12-23	\N	2	2025-12-24 00:03:28.237806
14	275	\N	23	3	Henrique Soares 	Rômulo Oliveira 	3	Rômulo Oliveira 	3-6, 6-4, 6-10	Amistoso	2025-12-26	\N	3	2025-12-26 23:59:08.822949
15	268	\N	1	3	Benjamin Pinto	Rômulo Oliveira 	3	Rômulo Oliveira 	0-6, 3-6	Amistoso	2025-12-23	\N	3	2025-12-26 23:59:24.393639
16	274	\N	\N	1	Nívia 	Benjamin Pinto	1	Benjamin Pinto	2-6, 0-6	Amistoso	2025-12-26	\N	1	2025-12-27 02:39:38.977647
17	278	\N	1	3	Benjamin Pinto	Rômulo Oliveira 	3	Rômulo Oliveira 	1-6, 3-6	Amistoso	2025-12-29	\N	3	2025-12-30 17:42:12.744877
18	287	\N	3	23	Rômulo Oliveira 	Henrique Soares 	3	Rômulo Oliveira 	6-4, 5-7, 12-10	Amistoso	2025-12-30	\N	3	2025-12-30 23:23:49.908843
19	290	\N	16	15	Neto Rezende	Breno Simões 	16	Neto Rezende	6-4, 2-0, 4-10	Amistoso	2026-01-02	\N	15	2026-01-03 01:21:01.437547
20	286	\N	1	35	Benjamin Pinto	Nívia	1	Benjamin Pinto	7-6, 7-5	Amistoso	2025-12-30	\N	1	2026-01-03 01:24:13.460801
21	285	\N	2	23	Bruno Marinho 	Henrique Soares 	23	Henrique Soares 	2-6, 4-6	Amistoso	2026-01-02	\N	2	2026-01-03 02:00:56.448662
22	292	\N	1	15	Benjamin Pinto	Breno Simões 	1	Benjamin Pinto	6-1, 4-6, 10-6	Amistoso	2026-01-03	\N	1	2026-01-03 19:31:06.621666
23	291	\N	2	3	Bruno Marinho 	Rômulo Oliveira 	2	Bruno Marinho 	3-6, 6-3, 10-6	Amistoso	2026-01-03	\N	2	2026-01-03 20:38:41.743196
24	302	\N	3	19	Rômulo Oliveira 	Paulo Vinicius 	3	Rômulo Oliveira 	6-4, 6-7, 12-10	Amistoso	2026-01-05	\N	3	2026-01-06 00:53:38.523566
25	294	\N	3	23	Rômulo Oliveira 	Henrique Soares 	23	Henrique Soares 	0-6, 6-4, 4-10	Amistoso	2026-01-06	\N	23	2026-01-06 22:50:36.687651
26	300	\N	17	15	Diana peixoto 	Breno Simões 	15	Breno Simões 	3-6, 2-6	Amistoso	2026-01-06	\N	15	2026-01-06 22:54:00.878014
27	299	\N	1	16	Benjamin Pinto	Neto Rezende	1	Benjamin Pinto	6-2, 4-2	Amistoso	2026-01-06	\N	1	2026-01-07 18:11:53.389844
28	320	\N	2	21	Bruno Marinho 	Valber Tenório	21	Valber Tenório	0-6, 2-6	Liga	2026-01-07	\N	2	2026-01-08 11:48:55.520718
\.


--
-- Data for Name: matches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.matches (id, schedule_id, status, betting_enabled, total_pool, house_edge, created_at) FROM stdin;
5	99	finished	t	10.00	0.20	2025-10-14 17:26:05.146959
4	83	finished	t	2200.00	0.20	2025-10-14 17:22:57.514494
6	95	cancelled	t	700.00	0.20	2025-10-15 10:05:02.733662
9	93	cancelled	t	500.00	0.20	2025-10-16 18:33:15.131142
7	89	finished	t	880.00	0.20	2025-10-15 20:30:23.538136
11	94	finished	t	81.00	0.20	2025-10-18 19:02:25.268726
13	101	finished	t	3.00	0.20	2025-10-20 15:02:21.418608
10	104	finished	t	1.00	0.20	2025-10-17 15:37:13.252531
12	106	finished	t	2.00	0.20	2025-10-18 19:05:06.71774
14	123	finished	t	65.00	0.20	2025-10-25 22:26:11.20167
\.


--
-- Data for Name: payment_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_logs (id, payment_id, event_type, status, amount, error_message, metadata, created_at) FROM stdin;
1	mock_pi_1760522705696	refund_attempt	failed	500.00	Request req_E5KZXCCwFg2ss2: No such payment_intent: 'mock_pi_1760522705696'	bet_id:4	2025-10-17 16:05:27.680016
2	mock_pi_1760531727619	refund_attempt	failed	200.00	Request req_QVXeJRk5yCGydb: No such payment_intent: 'mock_pi_1760531727619'	bet_id:5	2025-10-17 16:05:27.680016
3	mock_pi_1760639596215	refund_attempt	failed	500.00	Request req_zMtjLBtEXydxn0: No such payment_intent: 'mock_pi_1760639596215'	bet_id:9	2025-10-18 17:01:14.543246
4	mock_pi_1760560250360	refund_attempt	failed	5000.00	Request req_SSEz7WRn6WSucJ: No such payment_intent: 'mock_pi_1760560250360'	bet_id:7	2025-10-18 20:03:27.437583
5	129864473203	refund_attempt	failed	1.00	Request req_E5Q9Uq8L9ODEGi: No such payment_intent: '129864473203'	bet_id:11	2025-10-18 20:03:27.437583
\.


--
-- Data for Name: ranking_draws; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ranking_draws (id, round_id, player1_id, player2_id, group_type, drawn_at) FROM stdin;
26	1	10	6	elite	2025-12-31 20:09:54.827689
27	1	2	21	elite	2025-12-31 20:09:54.827689
28	1	20	23	elite	2025-12-31 20:09:54.827689
29	1	9	11	elite	2025-12-31 20:09:54.827689
30	1	2	6	elite	2025-12-31 20:09:54.827689
31	1	9	21	elite	2025-12-31 20:09:54.827689
32	1	10	23	elite	2025-12-31 20:09:54.827689
33	1	11	20	elite	2025-12-31 20:09:54.827689
34	1	19	32	challenger	2025-12-31 20:09:54.827689
35	1	3	28	challenger	2025-12-31 20:09:54.827689
36	1	25	26	challenger	2025-12-31 20:09:54.827689
37	1	1	31	challenger	2025-12-31 20:09:54.827689
38	1	8	18	challenger	2025-12-31 20:09:54.827689
39	1	22	34	challenger	2025-12-31 20:09:54.827689
40	1	29	30	challenger	2025-12-31 20:09:54.827689
41	1	35	33	challenger	2025-12-31 20:09:54.827689
42	1	15	27	challenger	2025-12-31 20:09:54.827689
43	1	16	32	challenger	2025-12-31 20:09:54.827689
44	1	34	28	challenger	2025-12-31 20:09:54.827689
45	1	25	3	challenger	2025-12-31 20:09:54.827689
46	1	27	26	challenger	2025-12-31 20:09:54.827689
47	1	8	31	challenger	2025-12-31 20:09:54.827689
48	1	30	19	challenger	2025-12-31 20:09:54.827689
49	1	1	18	challenger	2025-12-31 20:09:54.827689
50	1	29	33	challenger	2025-12-31 20:09:54.827689
51	1	35	16	challenger	2025-12-31 20:09:54.827689
52	1	15	22	challenger	2025-12-31 20:09:54.827689
\.


--
-- Data for Name: ranking_matches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ranking_matches (id, round_id, schedule_id, player1_id, player2_id, group_type, status, winner_id, score, sets_p1, sets_p2, games_p1, games_p2, wo_type, points_p1, points_p2, played_at, added_by, created_at) FROM stdin;
26	1	\N	10	6	elite	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
27	1	\N	2	21	elite	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
28	1	\N	20	23	elite	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
29	1	\N	9	11	elite	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
30	1	\N	2	6	elite	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
31	1	\N	9	21	elite	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
32	1	\N	10	23	elite	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
33	1	\N	11	20	elite	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
34	1	\N	19	32	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
35	1	\N	3	28	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
36	1	\N	25	26	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
37	1	\N	1	31	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
38	1	\N	8	18	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
39	1	\N	22	34	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
40	1	\N	29	30	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
41	1	\N	35	33	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
42	1	\N	15	27	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
43	1	\N	16	32	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
44	1	\N	34	28	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
45	1	\N	25	3	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
46	1	\N	27	26	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
47	1	\N	8	31	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
48	1	\N	30	19	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
49	1	\N	1	18	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
50	1	\N	29	33	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
51	1	\N	35	16	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
52	1	\N	15	22	challenger	scheduled	\N	\N	0	0	0	0	none	0	0	\N	\N	2025-12-31 20:09:54.827689
\.


--
-- Data for Name: ranking_participants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ranking_participants (id, season_id, user_id, temp_points, total_points, wins, losses, sets_won, sets_lost, games_won, games_lost, wo_wins, wo_losses, "position", is_active) FROM stdin;
9	1	21	2500	0	0	0	0	0	0	0	0	0	2	t
7	1	23	2000	0	0	0	0	0	0	0	0	0	3	t
16	1	9	2000	0	0	0	0	0	0	0	0	0	4	t
14	1	11	1600	0	0	0	0	0	0	0	0	0	5	t
3	1	20	1600	0	0	0	0	0	0	0	0	0	6	t
2	1	2	1200	0	0	0	0	0	0	0	0	0	8	t
24	1	32	1200	0	0	0	0	0	0	0	0	0	9	t
17	1	26	1200	0	0	0	0	0	0	0	0	0	11	t
1	1	3	1000	0	0	0	0	0	0	0	0	0	12	t
23	1	31	800	0	0	0	0	0	0	0	0	0	13	t
21	1	19	800	0	0	0	0	0	0	0	0	0	14	t
15	1	18	800	0	0	0	0	0	0	0	0	0	15	t
25	1	34	800	0	0	0	0	0	0	0	0	0	16	t
22	1	30	800	0	0	0	0	0	0	0	0	0	17	t
20	1	29	0	0	0	0	0	0	0	0	0	0	18	t
26	1	33	0	0	0	0	0	0	0	0	0	0	19	t
4	1	8	0	0	0	0	0	0	0	0	0	0	20	t
6	1	1	0	0	0	0	0	0	0	0	0	0	21	t
18	1	27	0	0	0	0	0	0	0	0	0	0	22	t
8	1	16	0	0	0	0	0	0	0	0	0	0	23	t
13	1	22	0	0	0	0	0	0	0	0	0	0	24	t
12	1	25	0	0	0	0	0	0	0	0	0	0	25	t
10	1	15	0	0	0	0	0	0	0	0	0	0	26	t
27	1	35	0	0	0	0	0	0	0	0	0	0	27	t
19	1	28	1200	0	0	0	0	0	0	0	0	0	10	t
11	1	10	1600	0	0	0	0	0	0	0	0	0	7	t
5	1	6	2500	0	0	0	0	0	0	0	0	0	1	t
\.


--
-- Data for Name: ranking_rounds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ranking_rounds (id, season_id, round_number, month, year, draw_date, description, status, is_finals) FROM stdin;
1	1	1	1	2026	\N		open	f
\.


--
-- Data for Name: ranking_season_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ranking_season_config (id, season_id, key, value, data_type) FROM stdin;
1	1	elite_cutoff	8	int
2	1	matches_per_round	2	int
3	1	win_points	100	int
4	1	loss_points	25	int
5	1	wo_win_points	132	int
6	1	wo_loss_points	-30	int
7	1	set_win_points	10	int
8	1	set_loss_points	-10	int
9	1	game_win_points	1	int
10	1	game_loss_points	-1	int
11	1	temp_points_expire_month	3	int
12	1	regular_rounds	10	int
13	1	finals_month	11	int
\.


--
-- Data for Name: ranking_seasons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ranking_seasons (id, year, start_date, end_date, description, status, created_at) FROM stdin;
1	2026	2026-01-01	2026-10-31	Ranking Geral	active	2025-12-30 14:03:36.395506
\.


--
-- Data for Name: ranking_temp_points_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ranking_temp_points_rules (id, season_id, position_min, position_max, points, label) FROM stdin;
11	1	1	2	2500	1º - 2º
12	1	3	4	2000	3º - 4º
13	1	5	6	1600	5º - 6º
14	1	7	8	1200	7º - 8º
15	1	9	10	1000	9º - 10º
16	1	11	16	800	11º - 16º
\.


--
-- Data for Name: recurring_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recurring_schedules (id, court_id, day_of_week, start_time, end_time, description, start_date, end_date) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refresh_tokens (id, user_id, token, expires_at, created_at, revoked, device_info) FROM stdin;
77	20	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyMCwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3NjgzOTE2NzJ9.YhJXqTdaLccBSXaknRFKQPmxviELI9z22xk8109g7X0	2026-01-14 11:54:32.301711	2026-01-07 11:54:32.291248	f	\N
78	26	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyNiwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3NjgzOTQ2NjF9.xivpnO7cDS7N0mthhN0xDhhFz9WsZCDkZMlFniC6d7U	2026-01-14 12:44:21.843872	2026-01-07 12:44:21.830131	f	\N
79	17	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxNywidHlwZSI6InJlZnJlc2giLCJleHAiOjE3NzAzOTA2Njh9.2OGaDygOtef9IN6eT_w5s6w6KR9ZPV_R8j7sLm3Brvc	2026-02-06 15:11:08.968319	2026-01-07 15:11:08.952905	f	\N
82	22	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyMiwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3Njg0NDMwODN9.lcMGNbJtU9NfMyhdW4qt62mMi_zMWbDijwArgvJu9HQ	2026-01-15 02:11:24.052879	2026-01-08 02:11:24.039259	f	\N
83	1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ0eXBlIjoicmVmcmVzaCIsImV4cCI6MTc2ODQ3OTIyOX0.3ev9lFayqp0tQOnyO9WKB9IQVTA6W9k3J5TMhQFDrYg	2026-01-15 12:13:49.571993	2026-01-08 12:13:49.557936	f	\N
46	27	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyNywidHlwZSI6InJlZnJlc2giLCJleHAiOjE3Njc3MTI2MzN9.bVuqWsmyPFH5eUz69gLdoCWZMXS9-LJlLpe6X9whVI0	2026-01-06 15:17:13.753396	2025-12-30 15:17:13.738693	f	\N
47	15	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxNSwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3Njk2OTk5MDh9.4XWfaIc2jW6xjw2wlsHztk4Ia6B9BWiPGRb1RiqzH8g	2026-01-29 15:18:28.411707	2025-12-30 15:18:28.397236	f	\N
48	28	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyOCwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3Njc3MTM5MjF9.xM9TUnVeLf_MbhfNuHCqwTWIzDl0_VPSLQL5f2zi0cA	2026-01-06 15:38:41.561482	2025-12-30 15:38:41.546846	f	\N
51	30	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozMCwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3Njc3MTY2MDJ9.t-f-DhzKX_YIAOFJZQEXMXpRTkQnZf4QC9OAc56qp1Q	2026-01-06 16:23:22.535254	2025-12-30 16:23:22.519068	f	\N
52	31	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozMSwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3Njc3MTY2MzF9.ZBS9BHbzaRQiNegb5ibdOMfQTD9-S_fov-eTDAqxPo8	2026-01-06 16:23:51.547908	2025-12-30 16:23:51.532026	f	\N
53	32	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozMiwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3Njc3MTgxNzd9.B23izQ0QiqOkoLY8IxvWv1vfnjoLMOsrvqrAzdOv3Uc	2026-01-06 16:49:37.75758	2025-12-30 16:49:37.740222	f	\N
55	35	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozNSwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3Njc3OTc3NDR9.5iscvf0m4Py0PpQEQ8SvVkb6FlOdplVzP5He7BYy3wQ	2026-01-07 14:55:45.056053	2025-12-31 14:55:45.04263	f	\N
56	11	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMSwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3Njc4MTc1MTZ9.ZC0Ghuu6JP3VYln72SmE6pmbvcLiYG3qaWiOZAyGuwc	2026-01-07 20:25:16.828977	2025-12-31 20:25:16.815298	f	\N
57	29	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyOSwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3Njk4MjMxNzV9.R4kS9T_S_5xWq_tt6ZKP3I3dEeGv-5n8yWMWGmAEt9Y	2026-01-31 01:32:55.847967	2026-01-01 01:32:55.825111	f	\N
59	21	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyMSwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3Njc5MjQ5NDZ9.b1fQauwPHjj7Z3lcPskgpmTJy17-5dYxQZhclKO8tw4	2026-01-09 02:15:46.20072	2026-01-02 02:15:46.18751	f	\N
61	2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJ0eXBlIjoicmVmcmVzaCIsImV4cCI6MTc2ODAwNDUwOX0.yfzOB-GmuOVCXmS5wsti4O_rEmyjhyRM9NV9WhAxegY	2026-01-10 00:21:49.620887	2026-01-03 00:21:49.606559	f	\N
65	19	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxOSwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3NzAxNjQxODB9.3IDgdT3lxHJ3D1bNA9MC1PYHdg0THuljpCGTTqF3ghE	2026-02-04 00:16:28.693934	2026-01-05 00:16:28.67946	f	\N
69	3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJ0eXBlIjoicmVmcmVzaCIsImV4cCI6MTc2ODIzNDk5OX0.n0pS2t1-YjuCdZeT-tIyXuOboVhnD-GKeeXAz9YEclk	2026-01-12 16:23:19.857734	2026-01-05 16:23:19.842451	f	\N
70	23	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyMywidHlwZSI6InJlZnJlc2giLCJleHAiOjE3NzAyMjY5MDF9.k3Nh-YxnUcTODpjFmuxPqoNV_BQII5S8tPJheZqWK-c	2026-02-04 17:41:41.624559	2026-01-05 17:41:41.609571	f	\N
71	16	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxNiwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3NjgyNDIwMDB9.KbSG3x9H98l1oX5vAVu4p_LvCHvJTtt-zAKI97j1W7M	2026-01-12 18:20:00.459447	2026-01-05 18:20:00.421151	f	\N
72	18	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxOCwidHlwZSI6InJlZnJlc2giLCJleHAiOjE3NjgyNDI0NjB9.FPKOrgZPtqLh6POFAXYJ7Jq9K55Lh0rcn8B3Btjc7ME	2026-01-12 18:27:40.921622	2026-01-05 18:27:40.909815	f	\N
73	9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjo5LCJ0eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MDMwMTM1MX0.yEfCdN5ZxdyYUlxe6J2BeG160NPuSeKpa_i81BCy2yQ	2026-02-05 14:22:31.267733	2026-01-06 14:22:31.252254	f	\N
\.


--
-- Data for Name: schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schedules (id, court_id, date, start_time, player1_name, player2_name, match_type, deleted_at, player1_id, player2_id) FROM stdin;
1	2	2025-09-30	18:00:00	Angelo Mendes	Bruno Marinho	Liga	\N	\N	\N
2	2	2025-09-26	19:30:00	Alexandre Barroso	Douglas Castro	Liga	\N	\N	\N
3	2	2025-09-25	16:30:00	Gilberto	JP Brandão	Liga	\N	\N	\N
4	2	2025-09-25	18:00:00	Rafaella	Marcelo	Liga	\N	\N	\N
5	2	2025-09-24	18:00:00	Angelo Mendes	Luiz Costa	Liga	\N	\N	\N
6	2	2025-09-23	16:30:00	Fernando	Raí	Liga	\N	\N	\N
7	2	2025-09-23	18:00:00	Rafaella	Paulo Vinícius	Liga	\N	\N	\N
8	2	2025-09-23	19:30:00	Renato	Gilberto	Liga	\N	\N	\N
9	2	2025-09-22	16:30:00	Bras	JP Brandão	Liga	\N	\N	\N
11	2	2025-09-19	16:30:00	Nadjane	Adilson	Amistoso	\N	\N	\N
12	2	2025-09-19	18:00:00	Alexandre Barroso	Bras	Liga	\N	\N	\N
238	2	2025-12-10	18:00:00	Neto Rezende	Joao Madero	Amistoso	\N	\N	\N
16	2	2025-09-22	15:00:00	Cascata Federer 	Alex revelação 	Aula	\N	\N	\N
17	2	2025-09-24	16:30:00	Fernando 	Cascata	Amistoso	\N	\N	\N
241	2	2025-12-12	19:30:00	Bruno Marinho 	Rômulo Oliveira 	Amistoso	\N	2	3
24	2	2025-09-24	15:00:00	Nadjane	Shirley 	Liga	\N	\N	\N
52	2	2025-10-08	18:00:00	Shirley	Thiago	Amistoso	\N	\N	\N
244	1	2025-12-16	16:30:00	Henrique Soares 	Joãozinho 	Amistoso	\N	23	\N
84	2	2025-10-09	19:30:00	Rômulo 	Bruno Marinho	Amistoso	\N	\N	\N
85	2	2025-10-14	16:30:00	Cascata Federer , Alex 	Beu, Fernando 	Amistoso	\N	\N	\N
86	2	2025-10-10	18:00:00	JP Duarte	Bruno Marinho	Amistoso	\N	\N	\N
22	2	2025-10-03	20:00:00	JP Duarte [PTC]	José Neto [JTC]	Torneio	\N	\N	\N
247	2	2025-12-15	18:00:00	Bruno Marinho 	João Paulo Duarte	Amistoso	\N	2	9
25	1	2025-10-03	16:00:00	Douglas [PTC]	João [JTC]	Torneio	\N	\N	\N
28	1	2025-10-03	19:00:00	Angelo [PTC]	Rodrigo Gluck [JTC]	Torneio	\N	\N	\N
30	1	2025-10-03	21:00:00	Rafaella [PTC]	Natalia [JTC]	Torneio	\N	\N	\N
250	2	2025-12-18	19:30:00	Luciandre	Gilberto	Amistoso	\N	18	\N
19	2	2025-10-03	18:00:00	Alexandre Barroso [PTC]	Cesar Toledo [JTC]	Torneio	\N	\N	\N
90	2	2025-10-13	18:00:00	Thiago 	Shirley 	Amistoso	\N	\N	\N
31	2	2025-09-25	19:30:00	Adilson	Rômulo 	Liga	\N	\N	\N
27	1	2025-10-03	17:00:00	Rômulo [PTC]	Inaldo [JTC]	Torneio	\N	\N	\N
253	2	2025-12-16	16:30:00	Nivia	Diana peixoto 	Amistoso	\N	\N	17
34	2	2025-09-30	16:30:00	Rafaella	Shirley	Liga	\N	\N	\N
35	2	2025-09-29	16:30:00	Cascata Federer 	Alex revelação 	Amistoso	\N	\N	\N
256	2	2025-12-22	16:30:00	Neto Rezende	Gilberto	Amistoso	\N	16	\N
259	2	2025-12-22	19:30:00	Bruno Marinho 	Henrique Soares 	Amistoso	\N	2	23
37	1	2025-10-03	22:00:00	Raí [PTC]	Leonardo [JTC]	Torneio	\N	\N	\N
38	2	2025-10-03	21:00:00	Renato [PTC]	Guilherme Rossiter [JTC]	Torneio	\N	\N	\N
262	1	2025-12-17	18:00:00	Bruno Marinho 	Rai	Amistoso	\N	2	\N
20	2	2025-10-03	16:00:00	Cascata [PTC]	Rossite [JTC]	Torneio	\N	\N	\N
40	2	2025-10-01	16:30:00	Cascata Federer 	Alex revelação 	Amistoso	\N	\N	\N
265	2	2025-12-19	18:00:00	Bruno Marinho 	Igor Lerner 	Amistoso	\N	2	10
42	2	2025-09-30	19:30:00	Rômulo Oliveira	Raí	Amistoso	\N	\N	\N
43	2	2025-10-02	16:30:00	Rafaella	Fernando	Amistoso	\N	\N	\N
268	2	2025-12-23	19:30:00	Benjamin Pinto	Rômulo Oliveira 	Amistoso	\N	1	3
45	1	2025-10-02	16:30:00	Lorena 	Lara	Amistoso	\N	\N	\N
94	2	2025-10-20	18:00:00	Rômulo Oliveira	Fernando	Liga	\N	\N	\N
95	2	2025-10-16	16:30:00	Cascata Federer 	João Paulo 	Liga	\N	\N	\N
271	1	2025-12-23	16:30:00	Lorena 	Davi Guedes 	Amistoso	\N	\N	\N
274	1	2025-12-26	18:00:00	Nívia 	Benjamin Pinto	Amistoso	\N	\N	1
110	1	2025-10-21	16:30:00	Lorena 	Lara	Amistoso	\N	\N	\N
98	2	2025-10-15	16:30:00	Guilherme Lopes 	Marcelo Oliveira 	Liga	\N	\N	\N
46	1	2025-10-02	18:00:00	Diana	Denilson	Amistoso	\N	\N	\N
21	2	2025-10-03	17:00:00	Igor (PTC)	Neanderson (JTC)	Torneio	\N	\N	\N
23	2	2025-10-03	19:00:00	Valber (PTC)	Curvelo (JTC)	Torneio	\N	\N	\N
29	1	2025-10-03	18:00:00	Benjamin [PTC]	Rafael [JTC]	Torneio	\N	\N	\N
26	1	2025-10-03	20:00:00	Bruno [PTC]	Rodrigo Ribeiro [JTC]	Torneio	\N	\N	\N
277	1	2025-12-29	16:30:00	Diana peixoto 	Alexandre Barroso 	Amistoso	\N	17	6
49	2	2025-10-06	19:30:00	Douglas 	JP Duarte	Liga	\N	\N	\N
50	2	2025-10-07	16:30:00	Cascata Federer 	Joãozinho ( Rivotril)	Amistoso	\N	\N	\N
51	2	2025-10-09	16:30:00	Cascata Federer 	Joãozinho ( Rivotril)	Amistoso	\N	\N	\N
53	2	2025-10-09	18:00:00	Thiago 	Shirley 	Amistoso	\N	\N	\N
99	1	2025-10-14	16:30:00	Rafaella	Shirley 	Amistoso	\N	\N	\N
83	2	2025-10-14	19:30:00	Barroso	Bruno Marinho	Liga	\N	\N	\N
15	2	2025-09-20	15:00:00	Cascata Federer 	Valber Tenório	Liga	\N	\N	21
100	1	2025-10-15	16:30:00	Breno	Colega do Breno 	Amistoso	\N	\N	\N
103	1	2025-10-16	16:30:00	Lorena 	Lara	Amistoso	\N	\N	\N
111	2	2025-10-22	18:00:00	Shirley 	Thiago	Amistoso	\N	\N	\N
93	2	2025-10-16	18:00:00	Rômulo Oliveira	Bruno	Amistoso	\N	\N	\N
91	2	2025-10-16	19:30:00	Rômulo 	Bruno	Amistoso	\N	\N	\N
112	2	2025-10-21	15:00:00	Thiago	Shirley 	Amistoso	\N	\N	\N
107	2	2025-10-21	16:30:00	Rafaella	Fernando 	Amistoso	\N	\N	\N
108	2	2025-10-23	16:30:00	Rafaella	JP Brandão	Liga	\N	\N	\N
113	1	2025-10-21	19:30:00	Breno simoes	Neto rezende	Amistoso	\N	\N	\N
115	1	2025-10-23	16:30:00	Lorena 	Lara	Amistoso	\N	\N	\N
33	2	2025-09-27	15:00:00	Cascata Federer 	Valber Tenório	Amistoso	\N	\N	21
48	2	2025-10-06	18:00:00	Rômulo Oliveira	Benjamin Pinto	Amistoso	\N	\N	1
120	1	2025-10-31	16:30:00	Guilherme	Gilberto	Liga	\N	\N	\N
121	2	2025-10-24	18:00:00	Breno	Neto 	Amistoso	\N	\N	\N
126	2	2025-10-27	19:30:00	Breno 	Neto 	Amistoso	\N	\N	\N
127	5	2025-10-29	18:00:00	 Henrique Cascata (Penedo)	Lucas Albuquerque (Arapiraca)	Torneio	\N	\N	\N
123	5	2025-10-28	18:00:00	Jp Duarte (Penedo)	Humberto (Arapiraca )	Torneio	\N	\N	\N
124	5	2025-10-30	19:30:00	Joaozinho (Penedo)	João J.G. (SE)	Torneio	\N	\N	\N
10	2	2025-09-20	07:30:00	Benjamin Pinto	Luiz Costa	Liga	\N	1	\N
13	2	2025-09-19	19:30:00	Luciandre	Bruno Marinho	Liga	\N	18	\N
87	2	2025-10-10	19:30:00	Paulo Vinicius 	Raí	Liga	\N	19	\N
116	2	2025-10-22	19:30:00	Rômulo Oliveira	Valber Tenório	Liga	\N	\N	21
130	5	2025-10-29	19:30:00	Benjamin Pinto (Penedo)	Felipe Griep (Arapiraca)	Torneio	\N	\N	\N
131	5	2025-10-29	21:00:00	Rômulo Oliveira	Diogo	Torneio	\N	\N	\N
242	2	2025-12-11	19:30:00	Bruno Marinho 	Rai	Amistoso	\N	2	\N
245	2	2025-12-15	16:30:00	Neto Rezende	Gilberto	Amistoso	\N	16	\N
135	2	2025-10-29	18:00:00	Shirley 	Thiago	Amistoso	\N	\N	\N
136	2	2025-10-31	18:00:00	Shirley 	Nadjane	Amistoso	\N	\N	\N
248	2	2025-12-15	19:30:00	Valber Tenório	Joãozinho 	Amistoso	\N	21	\N
251	2	2025-12-17	19:30:00	Rômulo Oliveira 	Valber Tenório	Amistoso	\N	3	21
139	2	2025-11-03	19:30:00	Neto Rezende	João	Amistoso	\N	\N	\N
254	2	2025-12-18	16:30:00	Henrique Soares 	Nívia 	Amistoso	\N	23	\N
141	2	2025-11-04	18:00:00	Shirley 	Thiago 	Amistoso	\N	\N	\N
257	1	2025-12-17	16:30:00	Diana peixoto 	Alexandre Barroso 	Amistoso	\N	17	6
143	2	2025-11-05	19:30:00	Diana	Breno 	Amistoso	\N	\N	\N
260	1	2025-12-18	18:00:00	Neto Rezende	Rômulo Oliveira	Amistoso	\N	16	\N
145	2	2025-11-04	16:30:00	Neto Rezende	Breno	Amistoso	\N	\N	\N
146	2	2025-11-05	16:30:00	Rafaella	Shirley 	Amistoso	\N	\N	\N
147	2	2025-11-06	18:00:00	Shirley	Tiago 	Amistoso	\N	\N	\N
181	1	2025-11-26	19:30:00	Adilson Nicacio	Rômulo Oliveira	Torneio	\N	\N	\N
149	1	2025-11-06	19:30:00	Breno simoes	Neto rezende	Amistoso	\N	\N	\N
150	2	2025-11-07	18:00:00	Denilson	Breno simoes	Amistoso	\N	\N	\N
266	2	2025-12-20	16:30:00	Nivia	Rafaella Moreira	Amistoso	\N	\N	8
152	1	2025-11-07	19:30:00	Neto Rezende	João Madeiro	Amistoso	\N	\N	\N
153	2	2025-11-11	18:00:00	Rafaella	Fernando	Amistoso	\N	\N	\N
154	2	2025-11-10	19:30:00	Rômulo Oliveira	Angelo Mendes	Amistoso	\N	\N	\N
269	1	2025-12-22	19:30:00	Rômulo Oliveira 	Raí	Amistoso	\N	3	\N
156	2	2025-11-11	19:30:00	Neto Rezende	Joao Madeiro	Amistoso	\N	\N	\N
272	2	2025-12-29	18:00:00	NIVIA	Rafaella Moreira	Amistoso	\N	\N	8
158	2	2025-11-12	19:30:00	Diana	Breno	Amistoso	\N	\N	\N
275	2	2025-12-26	18:00:00	Henrique Soares 	Rômulo Oliveira 	Amistoso	\N	23	3
160	1	2025-11-11	18:00:00	Fernando	Paulo Vinícius 	Amistoso	\N	\N	\N
161	2	2025-11-13	18:00:00	Neto Rezende	Rômulo Oliveira	Amistoso	\N	\N	\N
163	1	2025-11-14	18:00:00	Diana	Alexandre Barroso	Amistoso	\N	\N	\N
278	2	2025-12-29	19:30:00	Benjamin Pinto	Rômulo Oliveira 	Amistoso	\N	1	3
165	2	2025-11-16	15:00:00	Rafaella	Bruno Marinho	Amistoso	\N	\N	\N
166	2	2025-11-17	19:30:00	Rômulo Oliveira	Paulo Vinícius 	Amistoso	\N	\N	\N
167	2	2025-11-17	18:00:00	Fernando 	Rômulo Oliveira	Amistoso	\N	\N	\N
168	2	2025-11-19	19:30:00	Diana	Breno	Amistoso	\N	\N	\N
169	2	2025-11-18	19:30:00	Neto Rezende	João Madeiro	Amistoso	\N	\N	\N
280	1	2025-12-29	19:30:00	Neto Rezende	Paulo Vinicius 	Amistoso	\N	16	19
172	1	2025-11-18	19:30:00	Bruno 	Joao Paulo 	Amistoso	\N	\N	\N
173	2	2025-11-19	16:30:00	Fernando	Rafaella	Amistoso	\N	\N	\N
284	2	2026-01-02	18:00:00	Nívia 	Rafaella Moreira	Amistoso	\N	\N	8
179	1	2025-11-26	16:30:00	Guilherme Lopes 	Braz Araújo	Torneio	\N	\N	\N
185	1	2025-11-28	19:30:00	Rômulo Oliveira	Paulo Vinicius	Torneio	\N	\N	\N
184	1	2025-11-28	18:00:00	Adilson Nicacio	Luciandre Moraes	Torneio	\N	\N	\N
189	2	2025-11-24	19:30:00	Bruno Marinho	Alexandre Barroso	Torneio	\N	\N	\N
180	1	2025-11-26	18:00:00	Luciandre Moraes	Paulo Vinícius 	Torneio	\N	\N	\N
175	1	2025-11-24	16:30:00	Braz Araújo	JP Brandão	Torneio	\N	\N	\N
192	2	2025-11-26	18:00:00	Fernando Moreira	Valber Gouveia	Torneio	\N	\N	\N
194	2	2025-11-26	21:00:00	JP Duarte	Raí Freitas	Torneio	\N	\N	\N
195	2	2025-11-26	19:30:00	Alexandre Barroso	Henrique Soares	Torneio	\N	\N	\N
197	2	2025-11-28	19:30:00	Bruno Marinho	Henrique Soares	Torneio	\N	\N	\N
202	1	2025-11-21	18:00:00	Alexandre Barroso	Nivea	Amistoso	\N	\N	\N
203	2	2025-11-21	18:00:00	Rafael	Bruno Marinho	Amistoso	\N	\N	\N
204	1	2025-11-25	19:30:00	Adilson	Paulo	Torneio	\N	\N	\N
208	1	2025-11-24	18:00:00	Raí Freitas	Fernando Moreira	Torneio	\N	\N	\N
209	2	2025-11-25	18:00:00	JP Duarte	Fernando	Torneio	\N	\N	\N
215	2	2025-11-27	18:00:00	Fernando	Raí	Torneio	\N	\N	\N
216	2	2025-12-03	19:30:00	Bruno Marinho	Bruno Acioli	Amistoso	\N	\N	\N
217	2	2025-12-01	19:30:00	Joãozinho 	Bruno Marinho	Amistoso	\N	\N	\N
218	1	2025-12-02	16:30:00	Lorena 	Davi Guedes 	Amistoso	\N	\N	\N
219	2	2025-12-02	16:30:00	Shirley 	Rafaella	Amistoso	\N	\N	\N
221	1	2025-12-04	16:30:00	Lorena 	Davi Guedes 	Amistoso	\N	\N	\N
222	2	2025-12-04	16:30:00	Nivia	Rafaela 	Amistoso	\N	\N	\N
224	1	2025-12-04	19:30:00	Neto Rezende	Joao Madeiro	Amistoso	\N	\N	\N
225	2	2025-12-04	18:00:00	Alex revelação 	Joãozinho 	Amistoso	\N	\N	\N
226	2	2025-12-08	16:30:00	Nivia	Rafaela 	Amistoso	\N	\N	\N
227	2	2025-12-04	19:30:00	Rômulo Oliveira	Bruno Marinho	Amistoso	\N	\N	\N
228	1	2025-12-08	16:30:00	Alex	Fernando 	Amistoso	\N	\N	\N
229	2	2025-12-05	19:30:00	Rafael 	Bruno Marinho	Amistoso	\N	\N	\N
230	2	2025-12-09	19:30:00	Fernando	Bruno Marinho	Amistoso	\N	\N	\N
162	2	2025-11-14	19:30:00	Rômulo Oliveira	Benjamin Pinto	Amistoso	\N	\N	1
236	1	2025-12-09	16:30:00	Lorena 	Davi Guedes 	Amistoso	\N	\N	\N
237	2	2025-12-09	18:00:00	Joãozinho 	Bruno 	Amistoso	\N	\N	\N
109	2	2025-10-19	16:30:00	Valber Tenório	Bruno Marinho	Liga	\N	21	\N
170	2	2025-11-18	18:00:00	Luciandre 	Benjamin Pinto	Amistoso	\N	\N	1
188	2	2025-11-24	16:30:00	Henrique Soares	Renato Guedes	Torneio	\N	\N	11
196	2	2025-11-28	18:00:00	Alexandre Barroso	Renato Guedes	Torneio	\N	\N	11
186	1	2025-11-28	21:00:00	Braz Araújo	Benjamin Pinto	Torneio	\N	\N	1
177	1	2025-11-24	19:30:00	Guilherme Lopes	Benjamin Pinto	Torneio	\N	\N	1
210	1	2025-11-25	18:00:00	Raí	Valber Tenório	Torneio	\N	\N	21
212	1	2025-11-27	19:30:00	Adilson	Luciandre	Torneio	\N	\N	18
220	2	2025-12-02	19:30:00	Neto Rezende	Benjamin Pinto	Amistoso	\N	\N	1
233	2	2025-12-11	16:30:00	Nivia	Rafaella Moreira	Amistoso	\N	\N	8
88	2	2025-10-17	19:30:00	Paulo Vinicius 	Adilson	Liga	\N	19	\N
89	2	2025-10-17	18:00:00	Paulo Vinicius 	Raí	Liga	\N	19	\N
32	2	2025-09-26	16:30:00	Benjamin Pinto	Guilherme Lopes	Liga	\N	1	\N
44	2	2025-10-02	18:00:00	Luciandre	Romulo	Amistoso	\N	18	\N
96	2	2025-10-14	18:00:00	Benjamin Pinto	Breno Pinto 	Amistoso	\N	1	\N
92	2	2025-10-15	18:00:00	Renato Guedes	Braz	Liga	\N	11	\N
101	2	2025-10-21	18:00:00	Luciandre	João Paulo Brandão 	Liga	\N	18	\N
114	2	2025-10-23	19:30:00	Renato Guedes	Brás	Liga	\N	11	\N
117	2	2025-10-28	19:30:00	Benjamin Pinto	Angelo Mendes	Liga	\N	1	\N
118	2	2025-10-28	18:00:00	Luciandre	Gilberto	Liga	\N	18	\N
106	2	2025-10-23	18:00:00	Luciandre	Benjamin 	Amistoso	\N	18	\N
122	2	2025-10-25	15:00:00	Benjamin Pinto	Rômulo Oliveira	Amistoso	\N	1	\N
129	2	2025-10-27	18:00:00	Benjamin Pinto	Rômulo Oliveira	Amistoso	\N	1	\N
133	2	2025-10-28	15:00:00	Igor Lerner 	João JTC	Amistoso	\N	10	\N
134	2	2025-10-28	16:30:00	Renato Guedes	Rômulo Oliveira	Amistoso	\N	11	\N
137	2	2025-10-31	16:30:00	Benjamin Pinto	Breno 	Amistoso	\N	1	\N
140	2	2025-11-03	18:00:00	Renato Guedes	Joaozinho 	Amistoso	\N	11	\N
142	2	2025-11-04	19:30:00	Luciandre	Gilberto	Amistoso	\N	18	\N
144	1	2025-11-04	19:30:00	Benjamin Pinto	Rômulo Oliveira	Amistoso	\N	1	\N
148	2	2025-11-06	19:30:00	Benjamin Pinto	Denilson	Amistoso	\N	1	\N
157	1	2025-11-11	19:30:00	Benjamin Pinto	Rômulo Oliveira	Amistoso	\N	1	\N
174	2	2025-11-19	18:00:00	Renato Guedes	Joãozinho 	Amistoso	\N	11	\N
191	1	2025-11-27	18:00:00	Luciandre	Rômulo Oliveira	Torneio	\N	18	\N
200	2	2025-11-25	19:30:00	Renato Guedes	Bruno Marinho	Torneio	\N	11	\N
207	2	2025-11-24	18:00:00	Valber Tenório	JP Duarte	Torneio	\N	21	\N
213	2	2025-11-27	21:00:00	Benjamin Pinto	Bras	Torneio	\N	1	\N
214	2	2025-11-28	16:30:00	Valber Tenório	Fernando	Torneio	\N	21	\N
232	1	2025-12-09	19:30:00	Benjamin Pinto	Gilberto	Amistoso	\N	1	\N
235	2	2025-12-11	18:00:00	Henrique Soares 	Ângelo ( retorno aos treinos)	Amistoso	\N	23	\N
104	2	2025-10-21	19:30:00	Benjamin Pinto	Renato Guedes	Liga	\N	1	11
151	2	2025-11-07	19:30:00	Benjamin Pinto	Luiz Henrique	Amistoso	\N	1	24
234	2	2025-12-10	16:30:00	Fernando Moreira 	Paulo Alex 	Amistoso	\N	20	22
240	1	2025-12-11	19:30:00	Benjamin Pinto	Rômulo Oliveira 	Amistoso	\N	1	3
246	2	2025-12-18	18:00:00	Henrique Soares 	Ângelo ( treino continua )	Amistoso	\N	23	\N
252	2	2025-12-16	19:30:00	Benjamin Pinto	Rafaella Moreira	Amistoso	\N	1	8
255	2	2025-12-17	16:30:00	RF	Convidado	Amistoso	\N	26	\N
258	1	2025-12-18	19:30:00	Benjamin Pinto	Rômulo Oliveira 	Amistoso	\N	1	3
264	2	2025-12-17	18:00:00	RF	Convidados	Amistoso	\N	26	\N
267	1	2025-12-22	16:30:00	NIVIA	Rafaella Moreira	Amistoso	\N	\N	8
270	2	2025-12-23	16:30:00	Nívia 	Rafaella Moreira	Amistoso	\N	\N	8
273	1	2025-12-23	19:30:00	Bruno Marinho 	Rai	Amistoso	\N	2	\N
276	2	2025-12-26	19:30:00	Bruno Marinho 	Afranio	Amistoso	\N	2	\N
281	1	2025-12-29	18:00:00	Rômulo Oliveira 	Convidado 	Amistoso	\N	3	\N
285	1	2026-01-02	18:00:00	Bruno Marinho 	Henrique Soares 	Amistoso	\N	2	23
286	2	2025-12-30	16:30:00	Benjamin Pinto	Nívia	Amistoso	\N	1	\N
287	1	2025-12-30	16:30:00	Rômulo Oliveira 	Henrique Soares 	Amistoso	\N	3	23
307	2	2026-01-08	19:30:00	Benjamin Pinto	Angelo	Liga	\N	1	31
289	2	2026-01-02	16:30:00	Valber Tenório	Igor Lerner 	Amistoso	\N	21	10
290	1	2026-01-02	19:30:00	Neto Rezende	Breno Simões 	Amistoso	\N	16	15
291	2	2026-01-03	15:00:00	Bruno Marinho 	Rômulo Oliveira 	Amistoso	\N	2	3
292	2	2026-01-03	09:00:00	Benjamin Pinto	Breno Simões 	Amistoso	\N	1	15
294	2	2026-01-06	18:00:00	Rômulo Oliveira 	Henrique Soares 	Amistoso	\N	3	23
297	2	2026-01-12	19:30:00	Paulo Vinicius 	Benjamin Pinto	Amistoso	\N	19	1
298	2	2026-01-13	19:30:00	Paulo Vinicius 	Douglas Castro	Liga	\N	19	32
299	1	2026-01-06	19:30:00	Benjamin Pinto	Neto Rezende	Amistoso	\N	1	16
300	1	2026-01-06	18:00:00	Diana peixoto 	Breno Simões 	Amistoso	\N	17	15
301	1	2026-01-05	16:30:00	Diana peixoto 	Convidado	Amistoso	\N	17	\N
302	2	2026-01-05	19:30:00	Rômulo Oliveira 	Paulo Vinicius 	Amistoso	\N	3	19
303	2	2026-01-08	16:30:00	Henrique Soares 	Alex revelação 	Amistoso	\N	23	\N
304	1	2026-01-07	18:00:00	Neto Rezende	Gilberto	Amistoso	\N	16	33
305	2	2026-01-05	18:00:00	Luciandre	Neto Rezende	Amistoso	\N	18	16
306	2	2026-01-08	18:00:00	Rômulo Oliveira 	Guedes	Liga	\N	3	28
308	2	2026-01-07	16:30:00	João Paulo Duarte	Igor Lerner 	Amistoso	\N	9	10
309	1	2026-01-07	16:30:00	Diana peixoto 	Convidado	Amistoso	\N	17	\N
310	2	2026-01-12	16:30:00	Bras	Guedes	Liga	\N	34	28
314	2	2026-01-07	19:30:00	RF	Douglas Castro	Amistoso	\N	26	32
315	1	2026-01-13	19:30:00	Rômulo Oliveira 	RF	Amistoso	\N	3	26
316	1	2026-01-08	16:30:00	Diana peixoto 	Convidado 	Amistoso	\N	17	\N
317	1	2026-01-08	19:30:00	Gilberto	Lenemar	Amistoso	\N	33	\N
318	1	2026-01-13	18:00:00	Gilberto	Lenemar 	Amistoso	\N	33	\N
319	2	2026-01-07	18:00:00	Rômulo Oliveira 	Benjamin Pinto	Amistoso	\N	3	1
320	1	2026-01-07	19:30:00	Bruno Marinho 	Valber Tenório	Liga	\N	2	21
321	1	2026-01-12	19:30:00	Breno Simões 	Paulo Alex 	Liga	\N	15	22
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, name, phone, is_verified, verification_token, created_at, updated_at, is_lapen_member, lapen_approved, lapen_requested_at, lapen_approved_at, lapen_approved_by, pix_key, reset_token, reset_token_expires, is_admin, short_name, deleted_at) FROM stdin;
6	barrosoas@yahoo.com.br	$2b$12$G9agk5dFE5YOsgAC6gNrH.SgvpOPdBdrqsOqihAfrnCTeNXibNPOu	Alexandre Souza Barroso	82991151551	f	0PKMlhXxNYx46csCsmQe_blRbiGncWXs2GJSbOphtWk	2025-10-25 19:06:44.58315	2025-12-07 02:11:51.03414	t	t	2025-10-25 19:06:44.57861	2025-10-25 21:51:39.53865	\N	\N	\N	\N	f	Alexandre Barroso 	\N
3	romulloolliveiira@gmail.com	$2b$12$jvZirpOtqFts67pdZs3gferB/BgZcVzkm82LFvWqGtBpglzgGcmtS	Rômulo José Oliveira santos	82991280606	f	DtswmglwRrCWjZGej98fX6-iJG_yuKo0avimIFdRuV4	2025-10-19 22:19:08.378845	2025-12-07 02:11:51.03414	t	t	2025-10-25 12:19:45	2025-10-25 12:19:53	\N	\N	\N	\N	f	Rômulo Oliveira 	\N
16	netorezende@outlook.com.br	$2b$12$zrPB99qBTgoUuo0PtHiAdOYNnQ/2rzUIho.Dsd6PJOYeNcszldtOq	Antonio Carlos de Rezende Neto	82996645433	f	cDM1s3wkdlXWmiyUw-nC9-WgJucCMr50VIfR75tcEwU	2025-10-31 20:48:56.567069	2025-12-11 12:12:17.778623	t	t	2025-10-31 20:48:56.559982	2025-10-31 22:13:16.000758	\N		\N	\N	f	Neto Rezende	\N
8	rafaellasouzamoreira@gmail.com	$2b$12$ujsHTHcxA4XLA/kuGPZzQOcK7IYH0.r0ckNaDIPcrW8ZZagaROG16	Rafaella Moreira		f	VNu1aNkpF0ikkNMrHq5VKSKRs2vLUR89Q6-8uAFZCjA	2025-10-26 21:19:11.894304	2025-12-17 17:58:03.748389	t	t	2025-10-26 21:19:11.890164	2025-10-26 21:37:23.562331	\N	\N	iahHNbVUJwXxynM8qFnbQtKQ91natcyW3sMYQXHD1hs	2025-12-17 18:58:03.743841	f	Rafaella Moreira	\N
9	j.paulo-duarte@hotmail.com	$2b$12$zK/czJYApt5/NyTzbG/xC.GGheE2aL6Tl37/ERMxAYkdGYqOkgyly	João Paulo Duarte Pereira	~82996930007	t	\N	2025-10-27 13:20:38.719912	2026-01-06 14:22:10.056116	t	t	2025-10-27 13:20:38.715477	2025-10-27 13:23:37.029888	\N	\N	\N	\N	f	João Paulo Duarte	\N
7	pavip@hotmail.com	$2b$12$jM21eNpNDRfAQUPPPJyHBO24H6Qo2TUR5FSIlu3nCxaor68ErY0o6	Paulo Victor Malta Pinheiro Amancio	82999314771	t	\N	2025-10-25 22:54:11.707434	2025-12-07 01:21:49.589829	f	f	\N	\N	\N	\N	\N	\N	f	Paulo Victor 	\N
10	lernerigor@hotmail.com	$2b$12$3M6slVv/aeJBEUbX89ktY.5ASyurUC2BjyG3pIT7hT8E4nGvNhMRe	Igor Lerner Hora Ribeiro	82996991140	f	HpfNOOZeIwM0Fir4GYPxHklmNV4SVOFzJ47y08XBoJU	2025-10-28 14:29:55.842634	2025-12-07 01:21:49.589829	t	t	2025-10-28 14:29:55.838797	2025-10-28 17:09:03.494281	\N	\N	\N	\N	f	Igor Lerner 	\N
11	carlosrgramos@outlook.com	$2b$12$XSLnCZMnZyZEn4SIM9n4j.FxF8vndfvusdbYTihZ8IOXBQzGNmkOK	Renato Guedes	91993071005	t	\N	2025-10-28 18:34:30.595399	2025-12-07 01:21:49.589829	t	t	2025-10-28 18:34:30.5909	2025-10-28 18:37:56.737958	\N	\N	\N	\N	f	Renato Guedes	\N
15	brenosimoespinto@gmail.com	$2b$12$ost4dt699EcIUhHAK4FEnOHqcnUes2.fLCGjS4EEVNq84ukG0/b5G	Breno Simões Pinto	8296718328	f	cSlPfgQzpbs5oAJ8Mrx93U5YtFcoMWhIpO-l8jCPck8	2025-10-31 20:08:19.874363	2025-12-07 01:21:49.589829	t	t	2025-10-31 20:08:19.869069	2025-10-31 22:13:21.012999	\N	145.597.034-42	\N	\N	f	Breno Simões 	\N
14	shirleymsp23@gmail.com	$2b$12$FBJlgKBDT2MOGhWWY.ipu.l8w92uIJEi2R8r6gZlbMCuxEfoT.jGS	Shirley Maria da Silva Pereira	82999683870	f	UUTXI_Th4HfOqCnhEetugxi9JhwLajywSdmY4GEYuOk	2025-10-29 19:37:30.114362	2025-12-07 01:21:49.589829	t	t	2025-10-29 19:37:30.110268	2025-10-29 19:39:38.431481	\N	\N	\N	\N	f	Shirley Maria 	\N
17	dianadalles@hotmail.com	$2b$12$2tEVHnmeJWG0xkcVC8u/FeuscdFnOqBZ52/1juI0JDpILpcTEWzGm	Diana peixoto d barroso	79981368165	t	\N	2025-11-03 12:43:11.786978	2025-12-07 01:21:49.589829	t	t	2025-11-03 12:43:11.781822	2025-11-03 16:01:28.395362	\N	dianadalles@hotmail.com	\N	\N	f	Diana peixoto 	\N
22	pajaneiro@hotmail.com	$2b$12$eCMKA1Xlg1hOoHsLtyDQZ.KxyuxOKOvenuzzYjcqsNC8P21CE1m.i	Paulo Alex Silveira Nascimento	79999726071	t	\N	2025-12-01 20:36:46.860123	2025-12-07 01:21:49.589829	t	t	2025-12-01 20:36:46.854477	2025-12-02 00:32:50.389122	\N	80286950510	\N	\N	f	Paulo Alex 	\N
18	luciandre_fernandes@hotmail.com	$2b$12$jTSezYgl40eUIhBDVqBjpOgkBGmB.F9DLr57fDD9fyYPtmANhqwOi	Luciandre		t	\N	2025-11-03 21:35:11.202631	2025-12-07 01:21:49.589829	t	t	2025-11-03 21:35:11.197624	2025-11-03 21:38:04.560422	\N	82996138586	\N	\N	f	Luciandre	\N
21	tenorio_penedo@hotmail.com	$2b$12$ymPDltufaggmj50FYb414ujCCG4OZUEIE2KQHE0GKBrTizRXS5wuG	Valber Tenório	82993299828	f	Zp4W5bJNBJRgqNRxWftFvaVRRmnAzLvleyQOAjl3PE8	2025-11-27 13:02:22.147328	2025-12-07 01:21:49.589829	t	t	2025-11-27 13:02:22.142981	2025-11-27 13:03:33.020933	\N	02234811570	\N	\N	f	Valber Tenório	\N
20	fernandomoreiraal@gmail.com	$2b$12$KnweQ8VxL2gGRIpJYH6OoO3rt1S/53L35RPrTCL6RFMP0.Y4zeCh6	Fernando Pereira Moreira	82991176166	f	0azJWcCnhNcv4GcsJeS3DbC-X815xPG0DX23TM0uEHI	2025-11-11 18:54:05.117741	2025-12-07 02:11:51.03414	t	t	2025-11-11 18:54:05.113121	2025-11-11 18:55:01.612161	\N	82991176166	\N	\N	f	Fernando Moreira 	\N
23	henbriso@hotmail.com	$2b$12$6DMxa0ONRXowk/3InNb1Ku4THPLAPtFG.xV8KP11MjMapCDzFRvze	Henrique de Brito Soares	82991233151	f	ZoB7px-x7_-4edsRgXPRQ5NMwdxhS_AUn3VvOCgYtJM	2025-12-01 20:36:57.733306	2025-12-07 02:11:51.03414	t	t	2025-12-01 20:36:57.727823	2025-12-02 00:32:47.270672	\N	45634459400	\N	\N	f	Henrique Soares 	\N
2	nubro_oliveira@hotmail.com	$2b$12$wi5CathZANdWtZQFzCngV.SAlOsPA5dRDFHOusYjpPkqRE5Ky6eoy	Bruno Oliveira Duarte Marinho	82991020112	f	fF02ozfF0m5U1KWNWi4uI71IK_A926BQSq8khloNIQo	2025-10-14 17:51:37.300009	2025-12-07 02:11:51.03414	t	t	2025-10-25 12:19:44	2025-10-25 12:19:52	\N	07592564467	\N	\N	f	Bruno Marinho 	\N
28	joaoaraujo251011@gmail.com	$2b$12$tFiknn2GnbyjqNVy.NFCBefD2WMEOCvkYojdtYZhYVIcTSowKo1qm	João Araújo Guedes sobrinho	82988110000	f	TcztotBlQ644QOl-htBnRBVTChG1SaURZY3yrX2nTyk	2025-12-30 15:38:39.908629	2025-12-30 15:39:40.493391	t	t	2025-12-30 15:38:39.905789	2025-12-30 15:39:40.509146	\N	82988110000	\N	\N	f	Guedes	\N
1	benjaminpinto@gmail.com	$2b$12$mHWXdmjQETtd6YF3pFuEnOqcWsfHNNEhUd2ZutrOwqCq522e7e4s2	Benjamin Raimundo Pinto Neto	83981960846	f	jGTD5WQtNEzN2ZQCTBBg6PHIQXii-ZgiCqtg5kXkoAc	2025-10-08 19:52:43.311534	2026-01-04 23:16:44.357546	t	t	2025-10-25 12:19:41	2025-10-25 12:19:50	\N	07579095408	\N	\N	t	Benjamin Pinto	\N
24	luizhmtavares@gmail.com	$2b$12$zEaO9N3D8kta64RE3y42lu3XvuPLUTvCaaowQXiYyWxb1jFxNBvcG	LUIZ HENRIQUE MARTINS TAVARES	82996100880	t	\N	2025-12-10 00:26:05.089959	2025-12-10 00:33:23.529404	t	t	2025-12-10 00:26:05.082126	2025-12-10 00:33:23.53899	\N	82996100880	\N	\N	f	LUIZ HENRIQUE	\N
29	bac@oops.net.br	$2b$12$ToS3NHnc5IGsOlE00rAhO.7wdxZ8UiP65zRhAoWVYwHv.GnGQi/sW	marc victor carvalho cabadas	82988990292	f	rMpsRa7INXNX_tnwc6WLN71yUMhl5LlQ39uSkdtkfD0	2025-12-30 16:07:52.3084	2025-12-30 16:09:48.807893	t	t	2025-12-30 16:07:52.305901	2025-12-30 16:09:48.822862	\N	05133690401	\N	\N	f	bacureba	\N
25	israelsaldanhaneto@gmail.com	$2b$12$J3Q.34Vo7dty2583PrKfG.V54HIj9nLMS1D2cu1TWfuMzmXKg5GAi	Israel Ramires Saldanha Neto	82993517805	f	ZJU2hLHF3arh-kpbqsbIH6vnrS6wPjV6B_INtOx9xt0	2025-12-10 13:50:29.856285	2025-12-10 13:56:37.293175	t	t	2025-12-10 08:55:56	2025-12-10 13:56:37.307058	\N	16500059468	\N	\N	f	Israel	\N
26	raizao.rf@gmail.com	$2b$12$XjS0ok.6Azl5Ee2w.gb54egpQ07m2g.lXrA.Givx2qHmYuN/7v7oC	Raí Freitas		f	DtKGxrTZ2Xe2K9MVyNVVQ0FPQiAVviDaZ861xV664xI	2025-12-10 14:07:13.811637	2025-12-10 15:19:39.051717	t	t	2025-12-10 14:07:13.807573	2025-12-10 15:19:39.066891	\N	03594623599	\N	\N	f	RF	\N
27	brunnogalvao@brunnogalvao.com	$2b$12$fGrJKBN/WMPk.QjGg5afueVYxKkLyz5UlGx1Sqwq2urGGccRiyeTq	Brunno Galvao Sampaio	82999166905	f	JOwosIO6wsTFWjV7zRk3pFgUdiVNxynCEnrJzCOAxD0	2025-12-30 15:17:12.163813	2025-12-30 15:17:58.23307	t	t	2025-12-30 15:17:12.153452	2025-12-30 15:17:58.260937	\N	03895486426	\N	\N	f	Brunno Galvão	\N
31	angelo-mendes@hotmail.com	$2b$12$dQCWnXiZ7tkjh7vB2Zc7BuygP8K5mPqIlkxaZdDoWzgYZc7HiIUpm	Angelo Mendes	82993987768	f	XjNUbFidCp2Du06v5xEpcsyc7UZ9lvDRzMJEweqES-A	2025-12-30 16:23:50.330625	2025-12-30 16:24:40.097892	t	t	2025-12-30 16:23:50.327777	2025-12-30 16:24:40.113849	\N	00844097462	\N	\N	f	Angelo	\N
30	guilhermemlopes@hotmail.com	$2b$12$G9uK8X3vhZcTDQEHFiiA/.YW/reQ4RFNGYNFeplNZ9lJbN5v3UpKq	Guilherme Moreira Lopes	82988831700	f	At4SCduzGw-z9liGVgNQmHTWl3br7cdwU67vGQinAPM	2025-12-30 16:23:20.752946	2025-12-30 16:24:43.055186	t	t	2025-12-30 16:23:20.750605	2025-12-30 16:24:43.071263	\N	guilhermemlopes@hotmail.com	\N	\N	f	Guilherme Lopes	\N
32	douglassilvam@hotmail.com	$2b$12$ZLVZY0EvRoLu4Rq4.aKPKO3gS0d/HLY.qhNe1dBczc.2sw8uXED8i	Douglas Silva de Castro Monte	82999711658	f	frSGAIr-CE4G0H1PJv0b_27lAFYpHc5Mu30gLrJRR6E	2025-12-30 16:49:36.173193	2025-12-30 16:51:40.98778	t	t	2025-12-30 16:49:36.169396	2025-12-30 16:51:41.004304	\N	04865837400	\N	\N	f	Douglas Castro	\N
33	gilberto@null.com	$2b$12$mivy1HuXONzeqII5bct.Y.CqE8A90m1Yhhb516aPRSRgAB5bG5nIK	Gilberto Santana	\N	t	\N	2025-12-31 07:36:45	2025-12-31 07:36:49	t	t	2025-12-31 07:37:04	2025-12-31 07:37:06	\N	\N	\N	\N	f	Gilberto	\N
34	bras@null.com	$2b$12$mivy1HuXONzeqII5bct.Y.CqE8A90m1Yhhb516aPRSRgAB5bG5nIK	Bras	\N	t	\N	2025-12-31 07:36:45	2025-12-31 07:36:49	t	t	2025-12-31 07:37:04	2025-12-31 07:37:06	\N	\N	\N	\N	f	Bras	\N
35	niviasoaresvc@gmail.com	$2b$12$MtvPrv3.SYghAzAWAF1OUeBVTTJ8e3FR6yf6YUqJWcTnuR34PztGO	Nívia Soares	82999080824	f	Qh2N3MxcKSIBLtqil0HvHSCVALzPTKs-EIPGhfQ9Mtw	2025-12-31 14:55:43.506788	2025-12-31 14:55:59.417237	t	t	2025-12-31 14:55:43.502022	2025-12-31 14:55:59.43186	\N	05963603471	\N	\N	f	Nívia	\N
19	pvms210388@gmail.com	$2b$12$AmstTzfRYPN2VOtIo9YDteVPY8Sw.rNcJ2pUYgNU2JPix4RffkpGa	Paulo Vinicius Santos	82996978257	f	XZwknZTXQToM0Pgh3A-rlofc6AuEc0BFyKSz3Z_xkPo	2025-11-11 18:48:07.467252	2026-01-05 00:16:07.533997	t	t	2025-11-11 18:48:07.463167	2025-11-11 18:54:58.883309	\N	05920048484	\N	\N	f	Paulo Vinicius 	\N
\.


--
-- Name: bets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bets_id_seq', 29, true);


--
-- Name: challenges_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.challenges_id_seq', 2, true);


--
-- Name: courts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.courts_id_seq', 5, true);


--
-- Name: holidays_blocks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.holidays_blocks_id_seq', 10, true);


--
-- Name: match_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.match_results_id_seq', 8, true);


--
-- Name: match_statistics_unified_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.match_statistics_unified_id_seq', 28, true);


--
-- Name: matches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.matches_id_seq', 14, true);


--
-- Name: payment_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_logs_id_seq', 5, true);


--
-- Name: ranking_draws_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ranking_draws_id_seq', 52, true);


--
-- Name: ranking_matches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ranking_matches_id_seq', 52, true);


--
-- Name: ranking_participants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ranking_participants_id_seq', 27, true);


--
-- Name: ranking_rounds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ranking_rounds_id_seq', 1, true);


--
-- Name: ranking_season_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ranking_season_config_id_seq', 13, true);


--
-- Name: ranking_seasons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ranking_seasons_id_seq', 1, true);


--
-- Name: ranking_temp_points_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ranking_temp_points_rules_id_seq', 16, true);


--
-- Name: recurring_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.recurring_schedules_id_seq', 12, true);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 83, true);


--
-- Name: schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.schedules_id_seq', 321, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 35, true);


--
-- Name: bets bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bets
    ADD CONSTRAINT bets_pkey PRIMARY KEY (id);


--
-- Name: challenges challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_pkey PRIMARY KEY (id);


--
-- Name: courts courts_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_name_key UNIQUE (name);


--
-- Name: courts courts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courts
    ADD CONSTRAINT courts_pkey PRIMARY KEY (id);


--
-- Name: holidays_blocks holidays_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holidays_blocks
    ADD CONSTRAINT holidays_blocks_pkey PRIMARY KEY (id);


--
-- Name: match_results match_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_pkey PRIMARY KEY (id);


--
-- Name: match_statistics_unified match_statistics_unified_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_statistics_unified
    ADD CONSTRAINT match_statistics_unified_pkey PRIMARY KEY (id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: payment_logs payment_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_logs
    ADD CONSTRAINT payment_logs_pkey PRIMARY KEY (id);


--
-- Name: ranking_draws ranking_draws_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_draws
    ADD CONSTRAINT ranking_draws_pkey PRIMARY KEY (id);


--
-- Name: ranking_matches ranking_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_matches
    ADD CONSTRAINT ranking_matches_pkey PRIMARY KEY (id);


--
-- Name: ranking_participants ranking_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_participants
    ADD CONSTRAINT ranking_participants_pkey PRIMARY KEY (id);


--
-- Name: ranking_participants ranking_participants_season_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_participants
    ADD CONSTRAINT ranking_participants_season_id_user_id_key UNIQUE (season_id, user_id);


--
-- Name: ranking_rounds ranking_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_rounds
    ADD CONSTRAINT ranking_rounds_pkey PRIMARY KEY (id);


--
-- Name: ranking_rounds ranking_rounds_season_id_round_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_rounds
    ADD CONSTRAINT ranking_rounds_season_id_round_number_key UNIQUE (season_id, round_number);


--
-- Name: ranking_season_config ranking_season_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_season_config
    ADD CONSTRAINT ranking_season_config_pkey PRIMARY KEY (id);


--
-- Name: ranking_season_config ranking_season_config_season_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_season_config
    ADD CONSTRAINT ranking_season_config_season_id_key_key UNIQUE (season_id, key);


--
-- Name: ranking_seasons ranking_seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_seasons
    ADD CONSTRAINT ranking_seasons_pkey PRIMARY KEY (id);


--
-- Name: ranking_temp_points_rules ranking_temp_points_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_temp_points_rules
    ADD CONSTRAINT ranking_temp_points_rules_pkey PRIMARY KEY (id);


--
-- Name: recurring_schedules recurring_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_schedules
    ADD CONSTRAINT recurring_schedules_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_key UNIQUE (token);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_bets_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bets_match_id ON public.bets USING btree (match_id);


--
-- Name: idx_bets_match_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bets_match_status ON public.bets USING btree (match_id, status);


--
-- Name: idx_bets_match_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bets_match_user ON public.bets USING btree (match_id, user_id);


--
-- Name: idx_bets_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bets_player ON public.bets USING btree (player_name);


--
-- Name: idx_bets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bets_status ON public.bets USING btree (status);


--
-- Name: idx_bets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bets_user_id ON public.bets USING btree (user_id);


--
-- Name: idx_bets_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bets_user_status ON public.bets USING btree (user_id, status);


--
-- Name: idx_challenges_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenges_dates ON public.challenges USING btree (start_date, end_date);


--
-- Name: idx_challenges_players; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenges_players ON public.challenges USING btree (challenger_id, challenged_id);


--
-- Name: idx_challenges_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenges_status ON public.challenges USING btree (status);


--
-- Name: idx_courts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courts_active ON public.courts USING btree (active);


--
-- Name: idx_holidays_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_holidays_date ON public.holidays_blocks USING btree (date);


--
-- Name: idx_match_results_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_results_match_id ON public.match_results USING btree (match_id);


--
-- Name: idx_match_stats_unified_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_stats_unified_date ON public.match_statistics_unified USING btree (match_date);


--
-- Name: idx_match_stats_unified_names; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_stats_unified_names ON public.match_statistics_unified USING btree (player1_name, player2_name);


--
-- Name: idx_match_stats_unified_players; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_stats_unified_players ON public.match_statistics_unified USING btree (player1_id, player2_id);


--
-- Name: idx_match_stats_unified_ranking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_stats_unified_ranking ON public.match_statistics_unified USING btree (ranking_match_id) WHERE (ranking_match_id IS NOT NULL);


--
-- Name: idx_match_stats_unified_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_stats_unified_schedule ON public.match_statistics_unified USING btree (schedule_id) WHERE (schedule_id IS NOT NULL);


--
-- Name: idx_match_stats_unified_season; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_stats_unified_season ON public.match_statistics_unified USING btree (season_id) WHERE (season_id IS NOT NULL);


--
-- Name: idx_match_stats_unified_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_stats_unified_type ON public.match_statistics_unified USING btree (match_type);


--
-- Name: idx_matches_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_schedule ON public.matches USING btree (schedule_id);


--
-- Name: idx_matches_schedule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_schedule_id ON public.matches USING btree (schedule_id);


--
-- Name: idx_matches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_status ON public.matches USING btree (status);


--
-- Name: idx_payment_logs_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_logs_event_type ON public.payment_logs USING btree (event_type);


--
-- Name: idx_payment_logs_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_logs_payment_id ON public.payment_logs USING btree (payment_id);


--
-- Name: idx_ranking_draws_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ranking_draws_round ON public.ranking_draws USING btree (round_id);


--
-- Name: idx_ranking_matches_players; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ranking_matches_players ON public.ranking_matches USING btree (player1_id, player2_id);


--
-- Name: idx_ranking_matches_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ranking_matches_round ON public.ranking_matches USING btree (round_id);


--
-- Name: idx_ranking_participants_season_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ranking_participants_season_user ON public.ranking_participants USING btree (season_id, user_id);


--
-- Name: idx_recurring_court; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurring_court ON public.recurring_schedules USING btree (court_id);


--
-- Name: idx_recurring_day_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurring_day_dates ON public.recurring_schedules USING btree (day_of_week, start_date, end_date);


--
-- Name: idx_refresh_tokens_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);


--
-- Name: idx_refresh_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_token ON public.refresh_tokens USING btree (token);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_schedules_court_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_court_date ON public.schedules USING btree (court_id, date);


--
-- Name: idx_schedules_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_date ON public.schedules USING btree (date);


--
-- Name: idx_schedules_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_date_time ON public.schedules USING btree (date, start_time);


--
-- Name: idx_schedules_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_deleted_at ON public.schedules USING btree (deleted_at);


--
-- Name: idx_schedules_player1_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_player1_id ON public.schedules USING btree (player1_id);


--
-- Name: idx_schedules_player2_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedules_player2_id ON public.schedules USING btree (player2_id);


--
-- Name: idx_users_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bets bets_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bets
    ADD CONSTRAINT bets_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id);


--
-- Name: bets bets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bets
    ADD CONSTRAINT bets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: challenges challenges_challenged_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_challenged_id_fkey FOREIGN KEY (challenged_id) REFERENCES public.users(id);


--
-- Name: challenges challenges_challenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_challenger_id_fkey FOREIGN KEY (challenger_id) REFERENCES public.users(id);


--
-- Name: match_results match_results_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id);


--
-- Name: match_statistics_unified match_statistics_unified_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_statistics_unified
    ADD CONSTRAINT match_statistics_unified_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- Name: match_statistics_unified match_statistics_unified_player1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_statistics_unified
    ADD CONSTRAINT match_statistics_unified_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.users(id);


--
-- Name: match_statistics_unified match_statistics_unified_player2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_statistics_unified
    ADD CONSTRAINT match_statistics_unified_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.users(id);


--
-- Name: match_statistics_unified match_statistics_unified_ranking_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_statistics_unified
    ADD CONSTRAINT match_statistics_unified_ranking_match_id_fkey FOREIGN KEY (ranking_match_id) REFERENCES public.ranking_matches(id);


--
-- Name: match_statistics_unified match_statistics_unified_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_statistics_unified
    ADD CONSTRAINT match_statistics_unified_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id);


--
-- Name: match_statistics_unified match_statistics_unified_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_statistics_unified
    ADD CONSTRAINT match_statistics_unified_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.ranking_seasons(id);


--
-- Name: match_statistics_unified match_statistics_unified_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_statistics_unified
    ADD CONSTRAINT match_statistics_unified_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.users(id);


--
-- Name: matches matches_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id);


--
-- Name: ranking_draws ranking_draws_player1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_draws
    ADD CONSTRAINT ranking_draws_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.users(id);


--
-- Name: ranking_draws ranking_draws_player2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_draws
    ADD CONSTRAINT ranking_draws_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.users(id);


--
-- Name: ranking_draws ranking_draws_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_draws
    ADD CONSTRAINT ranking_draws_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.ranking_rounds(id);


--
-- Name: ranking_matches ranking_matches_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_matches
    ADD CONSTRAINT ranking_matches_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- Name: ranking_matches ranking_matches_player1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_matches
    ADD CONSTRAINT ranking_matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.users(id);


--
-- Name: ranking_matches ranking_matches_player2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_matches
    ADD CONSTRAINT ranking_matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.users(id);


--
-- Name: ranking_matches ranking_matches_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_matches
    ADD CONSTRAINT ranking_matches_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.ranking_rounds(id);


--
-- Name: ranking_matches ranking_matches_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_matches
    ADD CONSTRAINT ranking_matches_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id);


--
-- Name: ranking_matches ranking_matches_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_matches
    ADD CONSTRAINT ranking_matches_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.users(id);


--
-- Name: ranking_participants ranking_participants_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_participants
    ADD CONSTRAINT ranking_participants_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.ranking_seasons(id);


--
-- Name: ranking_participants ranking_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_participants
    ADD CONSTRAINT ranking_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: ranking_rounds ranking_rounds_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_rounds
    ADD CONSTRAINT ranking_rounds_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.ranking_seasons(id);


--
-- Name: ranking_season_config ranking_season_config_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_season_config
    ADD CONSTRAINT ranking_season_config_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.ranking_seasons(id);


--
-- Name: ranking_temp_points_rules ranking_temp_points_rules_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ranking_temp_points_rules
    ADD CONSTRAINT ranking_temp_points_rules_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.ranking_seasons(id);


--
-- Name: recurring_schedules recurring_schedules_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_schedules
    ADD CONSTRAINT recurring_schedules_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id);


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_court_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id);


--
-- Name: schedules schedules_player1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.users(id);


--
-- Name: schedules schedules_player2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.users(id);


--
-- Name: users users_lapen_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_lapen_approved_by_fkey FOREIGN KEY (lapen_approved_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

